import { z } from "zod";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { movieService } from "@/server/services/MovieService";
import { seriesService } from "@/server/services/SeriesService";
import type {
  ActionLog,
  Instance,
  SearchQueueAction,
  SearchQueueEntry,
} from "@/shared/types/models";
import { LogSource } from "@/shared/types/models";
import { appLogger } from "./app-logger";

function parsePayload(raw: string | null | undefined): unknown {
  return raw ? JSON.parse(raw) : {};
}

const seasonPayload = z.object({
  seasonNumber: z.number().int().nonnegative(),
});
const episodePayload = z.object({ fileId: z.number().int().positive() });

type SearchHandler = (
  instance: Instance,
  entry: SearchQueueEntry,
  payload: unknown,
) => Promise<ActionLog>;

// One handler per queue action. Record<Union, …> makes TypeScript flag a
// missing handler the moment a new SearchQueueAction is added — no runtime
// "unknown action" branch needed.
const SEARCH_HANDLERS: Record<SearchQueueAction, SearchHandler> = {
  movie: (instance, entry) =>
    movieService.triggerSearch(instance.id, entry.mediaId, entry.title, {
      groupId: entry.groupId ?? undefined,
    }),
  series: (instance, entry) =>
    seriesService.triggerSearch(instance.id, entry.mediaId, entry.title, {
      groupId: entry.groupId ?? undefined,
    }),
  season: (instance, entry, payload) => {
    const { seasonNumber } = seasonPayload.parse(payload);
    return seriesService.triggerSeasonSearch(
      instance.id,
      entry.mediaId,
      seasonNumber,
      entry.title,
      { groupId: entry.groupId ?? undefined },
    );
  },
  episode: (instance, entry, payload) => {
    const { fileId } = episodePayload.parse(payload);
    return seriesService.triggerEpisodeFileSearch(
      instance.id,
      entry.mediaId,
      fileId,
      entry.title,
      { groupId: entry.groupId ?? undefined },
    );
  },
};

/**
 * Per-instance loop that drains SearchQueue at the configured rate.
 *
 * Each enabled instance gets a setInterval at `3,600,000 / searchesPerHour`
 * ms. The first tick fires immediately so a fresh enqueue isn't stuck
 * waiting for a full slot. A `processing` Set guards against the rare
 * case where one tick takes longer than the interval — the next tick
 * skips itself rather than double-draining.
 *
 * setInterval (not a setTimeout chain) so a transient error in one tick
 * doesn't break the schedule for the next.
 */
class SearchWorker {
  private timers = new Map<number, NodeJS.Timeout>();
  private processing = new Set<number>();
  private lastProcessedAt = new Map<number, number>();
  private started = false;
  private startPromise: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.started) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  private async startInternal(): Promise<void> {
    if (this.started) return;
    const instances = await instanceRepository.findAllEnabled();
    for (const inst of instances) this.startForInstance(inst);
    this.started = true;
    appLogger.info("Search worker started", {
      source: LogSource.SearchWorker,
      context: { instances: instances.length, pid: process.pid },
    });
  }

  stop(): void {
    for (const handle of this.timers.values()) clearInterval(handle);
    this.timers.clear();
    this.processing.clear();
    this.lastProcessedAt.clear();
    this.started = false;
  }

  /** Restart the loop for one instance — used after the rate changes. */
  async refresh(instanceId: number): Promise<void> {
    const handle = this.timers.get(instanceId);
    if (handle) clearInterval(handle);
    this.timers.delete(instanceId);
    const instance = await instanceRepository.findById(instanceId);
    if (instance && instance.enabled) {
      this.startForInstance(instance);
    } else {
      // Instance deleted or disabled — drop the cooldown so it doesn't linger.
      this.lastProcessedAt.delete(instanceId);
    }
  }

  /**
   * Called from SearchQueueService.enqueue. If the rate budget allows
   * (last drain was longer than minDelayMs ago), drain one row now —
   * so the first enqueue fires immediately rather than waiting up to
   * minDelayMs for the next setInterval tick. Subsequent rapid enqueues
   * see lastProcessedAt is recent and skip; the setInterval handles
   * pacing them out.
   */
  async kick(instanceId: number): Promise<void> {
    if (!this.timers.has(instanceId)) return;
    if (this.processing.has(instanceId)) return;
    const instance = await instanceRepository.findById(instanceId);
    if (!instance || !instance.enabled) return;
    const minDelayMs = 3_600_000 / Math.max(1, instance.searchesPerHour);
    const last = this.lastProcessedAt.get(instanceId) ?? 0;
    if (Date.now() < last + minDelayMs) return;
    await this.processWithGuard(instance.id);
  }

  private async processWithGuard(instanceId: number): Promise<void> {
    if (this.processing.has(instanceId)) return;
    this.processing.add(instanceId);
    let drained = false;
    try {
      drained = await this.processOne(instanceId);
    } catch (e) {
      appLogger.error("Search worker tick failed", {
        source: LogSource.SearchWorker,
        err: e,
        context: { instanceId },
      });
    } finally {
      this.processing.delete(instanceId);
      // Only stamp on actual drain. Stamping on empty-queue ticks would
      // rate-limit a follow-up enqueue's kick(), which is the foot-gun
      // behind "queue keeps growing after it empties" reports.
      if (drained) {
        this.lastProcessedAt.set(instanceId, Date.now());
        appLogger.debug("Search worker drained", {
          source: LogSource.SearchWorker,
          context: { instanceId, drained },
        });
      }
    }
  }

  private startForInstance(instance: Instance): void {
    const instanceId = instance.id;
    const minDelayMs = 3_600_000 / Math.max(1, instance.searchesPerHour);
    // Capture only the id so the next tick re-reads instance config from the
    // repo via processOne / kick. Avoids stale closure values after a config
    // change (rate, enabled) lands without a refresh().
    const tick = () => {
      void this.processWithGuard(instanceId);
    };
    const handle = setInterval(tick, minDelayMs);
    handle.unref?.();
    this.timers.set(instanceId, handle);
    // Fire one tick immediately so a fresh enqueue or restart drains right
    // away rather than waiting up to minDelayMs for the first slot.
    tick();
  }

  private async processOne(instanceId: number): Promise<boolean> {
    const next = await searchQueueService.findNextPending(instanceId);
    if (!next) return false;

    const instance = await instanceRepository.findById(instanceId);
    if (!instance || !instance.enabled) {
      await searchQueueService.markFailed(
        next.id,
        "Instance not found or disabled",
      );
      return true;
    }

    try {
      await this.runSearch(instance, next);
      await searchQueueService.markDone(next.id);
      appLogger.info("Search dispatched", {
        source: LogSource.SearchWorker,
        context: {
          queueId: next.id,
          instanceId,
          action: next.action,
          mediaId: next.mediaId,
          title: next.title,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await searchQueueService.markFailed(next.id, message);
      appLogger.error("Search dispatch failed", {
        source: LogSource.SearchWorker,
        err: e,
        context: {
          queueId: next.id,
          instanceId,
          action: next.action,
          mediaId: next.mediaId,
          title: next.title,
        },
      });
    }
    return true;
  }

  private async runSearch(
    instance: Instance,
    entry: SearchQueueEntry,
  ): Promise<void> {
    // Route through the service layer so executeAction writes the ActionLog
    // row + invalidates the data cache. Calling client.triggerSearch directly
    // would skip both and the user would see nothing in History.
    const payload = parsePayload(entry.payload);
    // Lookup is type-safe at compile time, but the DB can hold any string
    // in the action column — guard against a corrupt/legacy row.
    const handler = SEARCH_HANDLERS[entry.action];
    if (!handler) throw new Error(`Unknown queue action: ${entry.action}`);
    const log = await handler(instance, entry, payload);
    // executeAction returns the ActionLog rather than throwing on upstream
    // failure. Re-throw so the queue row gets marked failed (and not done).
    if (log.status === "failed") {
      throw new Error(log.error ?? "Search dispatch failed");
    }
  }
}

// Persist across Next.js dev HMR — same trick as the Prisma client. Without
// this, file edits create a fresh SearchWorker, the old setInterval keeps
// running on a dead instance, and the new instance never picks up the queue
// until process restart.
const globalForSearchWorker = globalThis as unknown as {
  searchWorker?: SearchWorker;
};
const previousSearchWorker = globalForSearchWorker.searchWorker;
export const searchWorker = previousSearchWorker ?? new SearchWorker();
if (process.env.NODE_ENV !== "production") {
  // If a future change ever reassigns the singleton, stop the old one's
  // timers first so HMR doesn't accumulate ghost setIntervals firing on
  // dead closures. In practice `previousSearchWorker === searchWorker`
  // (same object via globalThis) and stop() is a no-op.
  if (previousSearchWorker && previousSearchWorker !== searchWorker) {
    previousSearchWorker.stop();
  }
  globalForSearchWorker.searchWorker = searchWorker;
}
