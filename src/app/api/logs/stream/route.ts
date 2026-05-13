import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { HttpError, badRequest } from "@/server/lib/api-errors";
import { appLogRepository } from "@/server/repositories/AppLogRepository";
import { eventBus, type ServerEvent } from "@/server/lib/event-bus";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/shared/types/models";
import type { AppLogEntry, LogLevel } from "@/shared/types/models";

const HEARTBEAT_MS = 25_000;
// Same ceiling as /api/events. Logs stream connections are typically
// 0 or 1 per browser (only when /logs is open). 8 leaves headroom for
// stale connections during dev HMR.
const MAX_CLIENTS = 8;
let activeClients = 0;

function matches(
  entry: AppLogEntry,
  filter: {
    level?: LogLevel;
    q?: string;
    source?: string;
    instanceId?: number;
  },
): boolean {
  if (filter.level && entry.level !== filter.level) return false;
  if (filter.source && entry.source !== filter.source) return false;
  if (filter.instanceId && entry.instanceId !== filter.instanceId) return false;
  if (filter.q && !entry.message.toLowerCase().includes(filter.q.toLowerCase()))
    return false;
  return true;
}

export const GET = createApiHandler(async (req: NextRequest) => {
  if (activeClients >= MAX_CLIENTS) {
    throw new HttpError({ status: 503, message: "Too many SSE connections" });
  }

  const resumeId = req.headers.get("last-event-id");
  const level = req.nextUrl.searchParams.get("level") as LogLevel | null;
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const source = req.nextUrl.searchParams.get("source") ?? undefined;
  // Reject malformed instanceId rather than silently dropping the
  // filter — a broadened stream after a typo'd link is more confusing
  // than a 400, and matches the cursor validation a few lines below.
  const instanceIdRaw = req.nextUrl.searchParams.get("instanceId");
  let instanceId: number | undefined;
  if (instanceIdRaw !== null) {
    const parsed = Number(instanceIdRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw badRequest("Invalid instanceId");
    }
    instanceId = parsed;
  }
  const filter = { level: level || undefined, q, source, instanceId };

  // Validate the resume cursor before using it in DB calls and id-dedup.
  // An invalid (NaN / negative) value would silently poison findSince().
  const rawId = resumeId ?? req.nextUrl.searchParams.get("lastId") ?? "0";
  const parsedId = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(parsedId))
    throw badRequest("Invalid cursor");
  let lastDeliveredId = parsedId;
  const isResume = resumeId !== null;

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: NodeJS.Timeout | null = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    if (heartbeat) clearInterval(heartbeat);
    activeClients = Math.max(0, activeClients - 1);
  };

  const stream = new ReadableStream({
    async start(controller) {
      activeClients += 1;

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Already closed.
        }
      };

      const sendEntry = (entry: AppLogEntry) => {
        if (entry.id <= lastDeliveredId) return; // dedupe race between backfill and bus
        if (!matches(entry, filter)) return;
        enqueue(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`);
        lastDeliveredId = Math.max(lastDeliveredId, entry.id);
      };

      const close = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        // Subscribe before backfill so no events are missed during the DB
        // query. Events that arrive during backfill are buffered; sendEntry's
        // id-dedup handles any overlap with the backfill results.
        const buffer: AppLogEntry[] = [];
        let buffering = true;
        unsubscribe = eventBus.subscribe((e: ServerEvent) => {
          if (e.type !== "applog") return;
          if (buffering) {
            buffer.push(e.entry);
          } else {
            sendEntry(e.entry);
          }
        });

        // Initial backfill on fresh connect (skipped on EventSource auto-reconnect
        // — those carry Last-Event-ID and only want the gap.)
        if (!isResume) {
          const initial = await appLogRepository.findLatest(200, filter);
          for (const entry of initial) sendEntry(entry);
        } else if (lastDeliveredId > 0) {
          const gap = await appLogRepository.findSince(lastDeliveredId, filter);
          for (const entry of gap) sendEntry(entry);
        }

        // Flush buffer — id-dedup in sendEntry drops anything already sent.
        for (const entry of buffer) sendEntry(entry);
        buffering = false;

        // Signal initial batch done (consumed by useAppLogs to flip "live").
        enqueue(`event: ready\ndata: {}\n\n`);

        heartbeat = setInterval(() => enqueue(`: heartbeat\n\n`), HEARTBEAT_MS);
        heartbeat.unref?.();

        req.signal.addEventListener("abort", close);
      } catch (err) {
        // Without logging, a Prisma error here (e.g. stale schema after
        // a migration) silently closes the SSE and the client spins on
        // "Reconnecting…" forever. Surface the cause.
        appLogger.error("Log stream init failed", {
          source: LogSource.Api,
          err,
        });
        close();
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
});
