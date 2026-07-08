import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { dispatchQueueEntry } from "@/server/arr/composition";
import type { Instance, SearchQueueEntry } from "@/shared/types/models";
import { LogSource } from "@/shared/types/models";
import { appLogger } from "./app-logger";
import {
  realScheduler,
  scheduleTrackedOnce,
  type Scheduler,
  type SchedulerHandle,
} from "./scheduler";

function parsePayload(raw: string | null | undefined): unknown {
  return raw ? JSON.parse(raw) : {};
}

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
  private timers = new Map<number, SchedulerHandle>();
  // Handles for the 0ms one-shot drains scheduled by kick() and the
  // startup tick. Tracked separately from the recurring `timers` so
  // stop() can cancel a pending one-shot — otherwise the worker could
  // dispatch one more search after it was meant to be dormant.
  private oneShotTimers = new Set<SchedulerHandle>();
  private processing = new Set<number>();
  private lastProcessedAt = new Map<number, number>();
  private started = false;
  private startPromise: Promise<void> | null = null;

  // Scheduler is injected so tests can swap the real timers for an inert
  // (integration tests) or fake-timer-driven (this worker's own tests) one.
  constructor(public scheduler: Scheduler = realScheduler) {}

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
    for (const handle of this.timers.values())
      this.scheduler.clearInterval(handle);
    for (const handle of this.oneShotTimers)
      this.scheduler.clearTimeout(handle);
    this.timers.clear();
    this.oneShotTimers.clear();
    this.processing.clear();
    this.lastProcessedAt.clear();
    this.started = false;
  }

  /** Restart the loop for one instance — used after the rate changes. */
  async refresh(instanceId: number): Promise<void> {
    const handle = this.timers.get(instanceId);
    if (handle) this.scheduler.clearInterval(handle);
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
    // Drain via the scheduler (0ms) rather than calling processWithGuard
    // directly: kick() is enqueue-triggered background work and must obey
    // the same gate as the timers, so an inert scheduler keeps it dormant.
    scheduleTrackedOnce(
      this.scheduler,
      this.oneShotTimers,
      () => void this.processWithGuard(instance.id),
    );
  }

  private async processWithGuard(instanceId: number): Promise<void> {
    if (this.processing.has(instanceId)) return;
    this.processing.add(instanceId);
    let drained = false;
    let inFlight: SearchQueueEntry | null = null;
    try {
      drained = await this.processOne(instanceId, (entry) => {
        inFlight = entry;
      });
    } catch (e) {
      appLogger.error("Search worker tick failed", {
        source: LogSource.SearchWorker,
        err: e,
        context: {
          instanceId,
          ...(inFlight
            ? {
                queueId: (inFlight as SearchQueueEntry).id,
                action: (inFlight as SearchQueueEntry).action,
                mediaId: (inFlight as SearchQueueEntry).mediaId,
              }
            : {}),
        },
      });
    } finally {
      this.processing.delete(instanceId);
      // Only stamp on actual drain. Stamping on empty-queue ticks would
      // rate-limit a follow-up enqueue's kick(), which is the foot-gun
      // behind "queue keeps growing after it empties" reports.
      if (drained) {
        this.lastProcessedAt.set(instanceId, Date.now());
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
    const handle = this.scheduler.setInterval(tick, minDelayMs);
    this.timers.set(instanceId, handle);
    // Fire one tick immediately so a fresh enqueue or restart drains right
    // away rather than waiting up to minDelayMs for the first slot. Routed
    // through the scheduler (0ms) — a direct call would bypass an inert
    // scheduler and drain the queue even when the worker is meant dormant.
    scheduleTrackedOnce(this.scheduler, this.oneShotTimers, tick);
  }

  private async processOne(
    instanceId: number,
    onEntry?: (entry: SearchQueueEntry) => void,
  ): Promise<boolean> {
    const next = await searchQueueService.findNextPending(instanceId);
    if (!next) return false;
    onEntry?.(next);

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
      appLogger.info(`Search dispatched: ${next.title} [${instance.name}]`, {
        source: LogSource.SearchWorker,
        context: {
          queueId: next.id,
          instanceId,
          instanceName: instance.name,
          action: next.action,
          mediaId: next.mediaId,
          title: next.title,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await searchQueueService.markFailed(next.id, message);
      appLogger.error(
        `Search dispatch failed: ${next.title} [${instance.name}]`,
        {
          source: LogSource.SearchWorker,
          err: e,
          context: {
            queueId: next.id,
            instanceId,
            instanceName: instance.name,
            action: next.action,
            mediaId: next.mediaId,
            title: next.title,
          },
        },
      );
    }
    return true;
  }

  private async runSearch(
    instance: Instance,
    entry: SearchQueueEntry,
  ): Promise<void> {
    // Dispatch through the arr composition root so per-arr modules own
    // their handler vocabulary (incl. zod payload schemas). search-worker
    // stays arr-agnostic; adding a new arr is one module file + the
    // BUILTIN_MODULES row, never an edit here.
    const payload = parsePayload(entry.payload);
    const log = await dispatchQueueEntry(instance, entry, payload);
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
}
// Populate the global in BOTH dev and prod (was dev-only, #135): Next.js
// evaluates server modules in more than one context (the instrumentation
// bundle vs the route/server bundle). Without a populated global in prod,
// each context builds AND starts its own worker → the queue drains twice
// and every search dispatches twice (duplicate grabs + history rows). The
// `previous ?? new` above then collapses later evaluations onto this one.
globalForSearchWorker.searchWorker = searchWorker;
