import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { appLogRepository } from "@/server/repositories/AppLogRepository";
import { eventBus, type ServerEvent } from "@/server/lib/event-bus";
import type { AppLogEntry, LogLevel } from "@/shared/types/models";

const HEARTBEAT_MS = 25_000;
// Same ceiling as /api/events. Logs stream connections are typically
// 0 or 1 per browser (only when /logs is open). 8 leaves headroom for
// stale connections during dev HMR.
const MAX_CLIENTS = 8;
let activeClients = 0;

function matches(entry: AppLogEntry, filter: { level?: LogLevel; q?: string }): boolean {
  if (filter.level && entry.level !== filter.level) return false;
  if (filter.q && !entry.message.toLowerCase().includes(filter.q.toLowerCase())) return false;
  return true;
}

export const GET = createApiHandler(async (req: NextRequest) => {
  if (activeClients >= MAX_CLIENTS) {
    return NextResponse.json({ error: "Too many SSE connections" }, { status: 503 });
  }

  const resumeId = req.headers.get("last-event-id");
  const level = req.nextUrl.searchParams.get("level") as LogLevel | null;
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const filter = { level: level || undefined, q };

  let lastDeliveredId = resumeId
    ? Number(resumeId)
    : Number(req.nextUrl.searchParams.get("lastId") ?? "0");
  const isResume = resumeId !== null;

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: NodeJS.Timeout | null = null;
  let closed = false;

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

      // Initial backfill on fresh connect (skipped on EventSource auto-reconnect
      // — those carry Last-Event-ID and only want the gap.)
      if (!isResume) {
        const initial = await appLogRepository.findLatest(200, filter);
        for (const entry of initial) sendEntry(entry);
      } else if (lastDeliveredId > 0) {
        // On resume, fill the gap between last-seen and now from the DB
        // before subscribing to the bus. Anything emitted via the bus while
        // we were doing the gap-fill races, but sendEntry's id-dedup
        // guards against duplicates.
        const gap = await appLogRepository.findSince(lastDeliveredId, filter);
        for (const entry of gap) sendEntry(entry);
      }

      // Signal initial batch done (consumed by useAppLogs to flip "live").
      enqueue(`event: ready\ndata: {}\n\n`);

      unsubscribe = eventBus.subscribe((e: ServerEvent) => {
        if (e.type === "applog") sendEntry(e.entry);
      });

      heartbeat = setInterval(() => enqueue(`: heartbeat\n\n`), HEARTBEAT_MS);
      heartbeat.unref?.();

      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
        activeClients = Math.max(0, activeClients - 1);
      };

      req.signal.addEventListener("abort", close);
    },
    cancel() {
      if (closed) return;
      closed = true;
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
      activeClients = Math.max(0, activeClients - 1);
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
