import { NextRequest } from "next/server";
import { ensureSeeded } from "@/server/lib/bootstrap";
import { eventBus, type ServerEvent } from "@/server/lib/event-bus";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";

// Streaming responses must run on Node, never the Edge runtime, and must
// not be cached or pre-rendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;
// Tight ceiling — leader-election in the client means typical use is
// 1 connection per browser session, ~3 across all the user's devices.
// If we ever exceed 8, something's wrong (broken leader election, a
// retry-loop bug, or an abusive client) and 503 is the right surface.
const MAX_CLIENTS = 8;
let activeClients = 0;

export async function GET(req: NextRequest) {
  await ensureSeeded();

  if (activeClients >= MAX_CLIENTS) {
    return new Response("Too many SSE connections", { status: 503 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: NodeJS.Timeout | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      activeClients += 1;

      const send = (data: ServerEvent | { type: "ready" }) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller may already be closed (race with abort) — ignore.
        }
      };

      // Initial "ready" so the client knows the connection is established.
      // Helps distinguish a stalled handshake from an idle connection.
      send({ type: "ready" });

      // Comment-only heartbeat keeps proxies / load balancers from idling
      // the connection out (nginx default is 60s). Comments are stripped
      // by the EventSource parser so the client never sees them.
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // Closed; cleanup happens via abort handler.
        }
      }, HEARTBEAT_MS);
      heartbeat.unref?.();

      unsubscribe = eventBus.subscribe(send);

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

  appLogger.debug("SSE client connected", {
    source: LogSource.Api,
    context: { activeClients },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell upstream proxies (nginx, Cloudflare) not to buffer.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Test-only — observe the live client count for assertions. */
export function _activeClientCount(): number {
  return activeClients;
}
