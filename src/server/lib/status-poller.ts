import { instanceRepository } from "@/server/repositories/InstanceRepository";
import {
  indexEventsByMediaId,
  statusPollerService,
} from "@/server/services/StatusPollerService";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import {
  describeFetchError,
  type UpstreamHistoryEvent,
} from "@/server/clients/ArrClient";
import type { Instance } from "@/shared/types/models";
import { appLogger } from "./app-logger";
import { LogSource } from "./log-sources";

// Single global cadence — every enabled instance ticks at this rate
// when healthy. 5 minutes is the sweet spot between "fast enough that
// the History page lifecycle status feels live" and "infrequent enough
// that we don't pound the upstream's /command + /history endpoints."
// Tunable via env if a deployment needs it; tested via fake timers so
// the test suite doesn't actually sleep.
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
export const POLL_INTERVAL_MS = (() => {
  const raw = parseInt(process.env.STATUS_POLLER_INTERVAL_MS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_MS;
})();

// Hard ceiling on the back-off interval — even after many consecutive
// failures, we still poll at least once an hour so a recovered upstream
// gets noticed without a manual refresh / process restart.
export const MAX_BACKOFF_MS = 60 * 60 * 1000;

// Initial history-sync `since` window when an instance is first seen.
// Caps the first poll's history fetch so we don't process a year of
// archived events on cold start. Subsequent ticks set `since` from the
// in-memory `lastPolledAt` map, so steady-state is just "events since
// last tick".
const FIRST_POLL_LOOKBACK_MS = 60 * 60 * 1000; // 1 hour

// Adaptive backoff: when both branches of a tick fail (instance
// unreachable, DNS down, etc.), double the next-tick delay up to
// MAX_BACKOFF_MS. Resets to base on the first tick that observes any
// successful upstream contact.
//
// Pure function, exported for unit testing.
//
//   failures=0 → base
//   failures=1 → 2 × base
//   failures=2 → 4 × base
//   failures=N → min(2^N × base, MAX_BACKOFF_MS)
export function computeBackoffMs(
  consecutiveFailures: number,
  baseMs: number = POLL_INTERVAL_MS,
  maxMs: number = MAX_BACKOFF_MS,
): number {
  const safeFailures = Math.max(0, Math.min(consecutiveFailures, 30));
  const multiplier = Math.pow(2, safeFailures);
  return Math.min(baseMs * multiplier, maxMs);
}

// Outcome of a single tick — drives the backoff decision and tells the
// scheduler whether to register the next timer.
type TickOutcome = "missing" | "ok" | "failed";

/**
 * Per-instance lifecycle-status poller. Mirrors `search-worker.ts`'s
 * singleton + HMR shape so the in-memory state survives Next.js dev
 * hot-reloads instead of stacking ghost timers.
 *
 * Memory + perf invariants:
 *   - In-memory state is bounded by enabled-instance count (Maps keyed
 *     by instanceId). One entry per instance per map.
 *   - Self-rescheduling `setTimeout` chain (not `setInterval`) so the
 *     interval can grow under back-off without clearing/re-registering.
 *     A generation token guards against stale closures racing a
 *     concurrent `refresh()` — old closures early-exit before
 *     scheduling another timer.
 *   - Each tick does at most two HTTP calls (history sync + command
 *     sync), both rate-limited via `ArrClient.fetch` →
 *     `arrRateLimiter`. Memory per tick is bounded by `pageSize=200`
 *     on /history and the upstream's internal cap on /command.
 *   - On consecutive failure, the next tick is delayed exponentially
 *     up to MAX_BACKOFF_MS. A single successful tick resets the
 *     counter back to base cadence.
 */
class StatusPoller {
  private timers = new Map<number, NodeJS.Timeout>();
  private processing = new Set<number>();
  private lastPolledAt = new Map<number, number>();
  // Per-instance count of consecutive ticks where BOTH polls failed.
  // Drives the back-off in `computeBackoffMs`. Cleared on success,
  // refresh, or stop.
  private consecutiveFailures = new Map<number, number>();
  // Per-instance generation token. Bumped every time `startForInstance`
  // runs (initial registration + every refresh). A tick closure
  // captures the gen at registration time and aborts before
  // rescheduling if the gen has moved on — prevents two parallel
  // setTimeout chains from competing after a refresh.
  private generations = new Map<number, number>();
  // Per-instance dedupe of warn logs. We only log a fetch failure
  // when its cause string differs from the last one we logged for
  // this instance/branch. Persistent same-cause failures (e.g. an
  // unreachable instance someone forgot to disable) log ONCE on first
  // failure + ONCE on recovery — not every 5 minutes. Separate maps
  // per branch so a partial failure (history works, command broken
  // on this Servarr version) still surfaces independently.
  private lastHistoryFailureCause = new Map<number, string>();
  private lastCommandFailureCause = new Map<number, string>();
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
    // Bootstrap path — don't fire immediate ticks. With many instances
    // it would stampede the upstream right after a deploy; the worker's
    // job is to observe state, not race the user's first action.
    for (const inst of instances) this.startForInstance(inst, false);
    this.started = true;
    appLogger.info("Status poller started", {
      source: LogSource.StatusPoller,
      context: {
        instances: instances.length,
        intervalMs: POLL_INTERVAL_MS,
        pid: process.pid,
      },
    });
  }

  stop(): void {
    for (const handle of this.timers.values()) clearTimeout(handle);
    this.timers.clear();
    this.processing.clear();
    this.lastPolledAt.clear();
    this.consecutiveFailures.clear();
    this.generations.clear();
    this.lastHistoryFailureCause.clear();
    this.lastCommandFailureCause.clear();
    this.started = false;
  }

  /**
   * Re-register one instance — used when an instance is added,
   * enabled, disabled, or successfully connection-tested. Mirror of
   * `searchWorker.refresh`. Bumps the instance's generation token so
   * any in-flight tick closure aborts before scheduling another timer.
   *
   * `immediate` defaults to true: most refresh callers (URL edit,
   * Test button) signal "user thinks it works now, check it" — they
   * want lifecycle updates within seconds rather than waiting up to
   * one full poll interval. Pass `immediate: false` for callers that
   * just need the schedule registered (e.g. brand-new instance with
   * zero ActionLog rows — the tick would be wasted I/O).
   */
  async refresh(
    instanceId: number,
    options: { immediate?: boolean } = {},
  ): Promise<void> {
    const { immediate = true } = options;
    const handle = this.timers.get(instanceId);
    if (handle) clearTimeout(handle);
    this.timers.delete(instanceId);
    this.consecutiveFailures.delete(instanceId);
    // The user changed something (URL, key, enabled flag) or a
    // connection test passed — any prior failure cause is obsolete.
    // Clearing the dedupe state ensures the next failure (if any) is
    // logged fresh and not silently suppressed.
    this.lastHistoryFailureCause.delete(instanceId);
    this.lastCommandFailureCause.delete(instanceId);
    const instance = await instanceRepository.findById(instanceId);
    if (instance && instance.enabled) {
      this.startForInstance(instance, immediate);
    } else {
      // Instance deleted or disabled — drop in-memory state so it
      // doesn't linger.
      this.lastPolledAt.delete(instanceId);
    }
  }

  private startForInstance(instance: Instance, immediate: boolean): void {
    const instanceId = instance.id;
    // Bump the generation. Any prior tick closure for this instance
    // captures the OLD gen and will early-exit on its next reschedule
    // attempt, preventing dual-running setTimeout chains.
    const gen = (this.generations.get(instanceId) ?? 0) + 1;
    this.generations.set(instanceId, gen);

    // Capture only the id; the tick re-reads instance + builds a
    // fresh ArrClient so config changes (URL, key) propagate without
    // an explicit refresh call.
    const tick = async () => {
      // Stale closure guard — refresh() (or stop()) bumped the gen.
      if (this.generations.get(instanceId) !== gen) return;

      let outcome: TickOutcome = "ok";
      if (this.processing.has(instanceId)) {
        // Defensive: shouldn't happen with a setTimeout chain (each
        // schedule waits for the previous tick to finish), but kept
        // as a guard if a future refactor reintroduces overlap.
        outcome = "ok";
      } else {
        this.processing.add(instanceId);
        try {
          outcome = await this.processOne(instanceId);
        } finally {
          this.processing.delete(instanceId);
        }
      }

      // Instance went away mid-tick — processOne has already cleaned
      // up the timer + state. Don't reschedule.
      if (outcome === "missing") return;

      if (outcome === "ok") {
        this.consecutiveFailures.delete(instanceId);
      } else {
        const prev = this.consecutiveFailures.get(instanceId) ?? 0;
        this.consecutiveFailures.set(instanceId, prev + 1);
      }

      // Re-check generation after the awaited processOne — a refresh
      // during the tick should still abort us before we schedule.
      if (this.generations.get(instanceId) !== gen) return;

      const delay = computeBackoffMs(
        this.consecutiveFailures.get(instanceId) ?? 0,
      );
      const next = setTimeout(tick, delay);
      next.unref?.();
      this.timers.set(instanceId, next);
    };

    if (immediate) {
      // Refresh path — user just changed something or a connection
      // test passed. Fire one tick now (fire-and-forget; the closure
      // serializes against subsequent ticks via the `processing`
      // guard) so lifecycle status updates within seconds rather than
      // waiting one full POLL_INTERVAL_MS. The recurring timer below
      // still arms normally.
      void tick();
    }

    // Don't fire immediately on bootstrap — many enabled instances
    // would stampede the upstream the moment the server starts. The
    // worker's job is to observe state, not race the user's first
    // action. Refresh() opts in via `immediate=true` for the
    // single-instance case where waiting feels broken.
    const handle = setTimeout(tick, POLL_INTERVAL_MS);
    handle.unref?.();
    this.timers.set(instanceId, handle);
  }

  private async processOne(instanceId: number): Promise<TickOutcome> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance || !instance.enabled) {
      // Instance went away mid-flight; drop our timer to match.
      const handle = this.timers.get(instanceId);
      if (handle) clearTimeout(handle);
      this.timers.delete(instanceId);
      this.lastPolledAt.delete(instanceId);
      this.consecutiveFailures.delete(instanceId);
      this.generations.delete(instanceId);
      return "missing";
    }

    const client = ArrClientFactory.createArrClient(instance);
    const since = new Date(
      this.lastPolledAt.get(instanceId) ?? Date.now() - FIRST_POLL_LOOKBACK_MS,
    );

    // Sequence: history sync first so its events feed the command-sync
    // pass for completionMessage synthesis (newer Servarr versions don't
    // include `body.completionMessage` on /command responses, so we
    // derive "No releases grabbed" from the absence of a `grabbed`
    // event instead). The total wall-clock cost is one extra round-trip
    // — immaterial vs the 5-min interval.
    //
    // We catch each branch independently so a network blip on one path
    // doesn't blank the other. Both polls log their own errors.
    let historyUpdates = 0;
    let eventsByMediaId = new Map<number, UpstreamHistoryEvent[]>();
    let historyOk = false;
    try {
      const result = await statusPollerService.pollHistory(
        instance,
        client,
        since,
      );
      historyUpdates = result.updates;
      eventsByMediaId = indexEventsByMediaId(result.events);
      historyOk = true;
      this.maybeLogRecovery(
        instanceId,
        instance,
        this.lastHistoryFailureCause,
        "history",
      );
    } catch (err) {
      // Unwrap Node fetch's wrapped error so the log says
      // "ECONNREFUSED" / "ENOTFOUND" / etc. instead of just
      // "fetch failed" — that's the diagnosable bit.
      this.maybeLogFailure(
        instanceId,
        instance,
        this.lastHistoryFailureCause,
        "history",
        err,
      );
    }

    let commandUpdates = 0;
    let commandsOk = false;
    try {
      commandUpdates = await statusPollerService.pollCommands(
        instance,
        client,
        eventsByMediaId,
      );
      commandsOk = true;
      this.maybeLogRecovery(
        instanceId,
        instance,
        this.lastCommandFailureCause,
        "command",
      );
    } catch (err) {
      this.maybeLogFailure(
        instanceId,
        instance,
        this.lastCommandFailureCause,
        "command",
        err,
      );
    }

    // Stamp lastPolledAt only when at least one branch succeeded; if
    // both errored (network blip, instance unreachable), let the next
    // tick re-poll the same window.
    if (historyOk || commandsOk) {
      this.lastPolledAt.set(instanceId, Date.now());
    }

    if (commandUpdates > 0 || historyUpdates > 0) {
      appLogger.info("Status poller updated rows", {
        source: LogSource.StatusPoller,
        context: {
          instanceId,
          commandUpdates,
          historyUpdates,
        },
      });
    }

    return historyOk || commandsOk ? "ok" : "failed";
  }

  // Logs a per-branch fetch failure, but only when the cause string
  // differs from the last logged cause for this branch on this
  // instance. Persistent same-cause failures (e.g. an unreachable
  // host someone forgot to disable) get ONE warn entry on the first
  // failure + one info entry on recovery, instead of one per tick.
  private maybeLogFailure(
    instanceId: number,
    instance: Instance,
    lastByInstance: Map<number, string>,
    branch: "history" | "command",
    err: unknown,
  ): void {
    const cause = describeFetchError(err);
    if (lastByInstance.get(instanceId) === cause) return;
    lastByInstance.set(instanceId, cause);
    appLogger.warn(`Status poller ${branch} sync failed`, {
      source: LogSource.StatusPoller,
      err,
      context: {
        instanceId,
        instanceName: instance.name,
        instanceUrl: instance.url,
        branch,
        cause,
      },
    });
  }

  // Pairs with maybeLogFailure: when a branch succeeds after a prior
  // failure, emit ONE info-level "recovered" entry (with the previous
  // cause for context) and clear the dedupe state so the next failure
  // logs fresh.
  private maybeLogRecovery(
    instanceId: number,
    instance: Instance,
    lastByInstance: Map<number, string>,
    branch: "history" | "command",
  ): void {
    const previousCause = lastByInstance.get(instanceId);
    if (!previousCause) return;
    lastByInstance.delete(instanceId);
    appLogger.info(`Status poller ${branch} sync recovered`, {
      source: LogSource.StatusPoller,
      context: {
        instanceId,
        instanceName: instance.name,
        instanceUrl: instance.url,
        branch,
        previousCause,
      },
    });
  }
}

// Persist across Next.js dev HMR — same trick as search-worker /
// Prisma. Without this, file edits create a fresh StatusPoller, the
// old timers keep running on a dead instance, and the new one never
// picks up the schedule until process restart.
const globalForStatusPoller = globalThis as unknown as {
  statusPoller?: StatusPoller;
};
const previousStatusPoller = globalForStatusPoller.statusPoller;
export const statusPoller = previousStatusPoller ?? new StatusPoller();
if (process.env.NODE_ENV !== "production") {
  if (previousStatusPoller && previousStatusPoller !== statusPoller) {
    previousStatusPoller.stop();
  }
  globalForStatusPoller.statusPoller = statusPoller;
}
