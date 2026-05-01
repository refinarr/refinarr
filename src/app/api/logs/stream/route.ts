import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { appLogRepository } from "@/server/repositories/AppLogRepository";
import type { LogLevel } from "@/shared/types/models";

export const GET = createApiHandler(async (req: NextRequest) => {
  const resumeId = req.headers.get("last-event-id");
  const level = req.nextUrl.searchParams.get("level") as LogLevel | null;
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const filter = { level: level || undefined, q };

  let currentLastId = resumeId
    ? Number(resumeId)
    : Number(req.nextUrl.searchParams.get("lastId") ?? "0");
  const isResume = resumeId !== null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => {
        if (!req.signal.aborted) controller.enqueue(encoder.encode(chunk));
      };

      // Send initial batch on fresh connect (not on EventSource auto-reconnect)
      if (!isResume) {
        const initial = await appLogRepository.findLatest(200, filter);
        for (const entry of initial) {
          enqueue(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`);
          currentLastId = Math.max(currentLastId, entry.id);
        }
      }

      // Signal to client that initial batch is done
      enqueue(`event: ready\ndata: {}\n\n`);

      const poll = async () => {
        if (req.signal.aborted) return;
        try {
          const entries = await appLogRepository.findSince(currentLastId, filter);
          if (req.signal.aborted) return;
          for (const entry of entries) {
            enqueue(`id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`);
            currentLastId = Math.max(currentLastId, entry.id);
          }
          enqueue(`: heartbeat\n\n`);
        } catch {
          // Don't crash the stream on transient DB errors
        }
      };

      const interval = setInterval(() => { void poll(); }, 2000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
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
