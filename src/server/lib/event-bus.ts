import { EventEmitter } from "events";
import type { AppLogEntry } from "@/shared/types/models";

/**
 * Server-pushed events for the SSE channel. Keep this list small —
 * each entry is something the UI cares about updating in response to.
 * The client maps event types to TanStack Query invalidations or to a
 * direct stream consumer (e.g. the /logs page tail).
 */
export type ServerEvent =
  | { type: "queue-changed"; instanceId: number }
  | { type: "queue-cleared"; instanceId: number }
  | { type: "history-changed"; instanceId: number }
  | { type: "applog"; entry: AppLogEntry };

class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Sized for MAX_CLIENTS (8) SSE clients each subscribing once, plus
    // headroom for future internal subscribers (background workers, etc).
    // Node's default of 10 fires a noisy process warning past that limit.
    this.emitter.setMaxListeners(16);
  }

  emit(event: ServerEvent): void {
    this.emitter.emit("event", event);
  }

  subscribe(listener: (event: ServerEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  /** Test hook — dispose all subscribers between tests. */
  reset(): void {
    this.emitter.removeAllListeners();
  }
}

// Persist across Next.js dev HMR — same trick as the Prisma client and
// the SearchWorker. Without this, an SSE handler subscribed via the OLD
// module reference sees its old emitter while emit() calls land on the
// new emitter, silently dropping events.
const globalForEventBus = globalThis as unknown as { eventBus?: EventBus };
export const eventBus = globalForEventBus.eventBus ?? new EventBus();
if (process.env.NODE_ENV !== "production") globalForEventBus.eventBus = eventBus;
