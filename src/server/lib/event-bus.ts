import { EventEmitter } from "events";
import type { ServerEvent } from "@/shared/types/api";
import { logger } from "./logger";

class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Sized for MAX_CLIENTS (8) SSE clients each subscribing once, plus
    // headroom for future internal subscribers (background workers, etc).
    // Node's default of 10 fires a noisy process warning past that limit.
    this.emitter.setMaxListeners(16);
  }

  emit(event: ServerEvent): void {
    for (const listener of this.emitter.listeners("event")) {
      try {
        (listener as (e: ServerEvent) => void)(event);
      } catch (err) {
        logger.error(err, "EventBus listener threw");
      }
    }
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
if (process.env.NODE_ENV !== "production")
  globalForEventBus.eventBus = eventBus;
