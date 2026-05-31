import crypto from "crypto";
import { CronExpressionParser } from "cron-parser";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { logRepository } from "@/server/repositories/LogRepository";
import { mediaServiceFor } from "@/server/arr/composition";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import { searchQueueService } from "@/server/services/SearchQueueService";
import type {
  AutoSearchScoringMode,
  Instance,
  MediaItem,
  ScoringMode,
} from "@/shared/types/models";

import { ARR_META } from "@/shared/arr-meta";
import type { AutoSearchStatus } from "@/shared/types/api";
import { LogSource } from "@/shared/types/models";
import { SCORE_FOR } from "@/shared/scoring-mode";
import { isValidCronExpression } from "@/shared/cron";
import { appLogger } from "./app-logger";
import {
  realScheduler,
  type Scheduler,
  type SchedulerHandle,
} from "./scheduler";

// HMR globals — declared on globalThis so the singleton survives module
// reloads. Typing them here is what lets startInternal() / the module-init
// block read and write without `as unknown as { … }` casts at each access.
// `var` (not let/const) is required by the `declare global` augmentation
// spec for properties to attach to globalThis.
declare global {
  var autoRunner: AutoRunner | undefined;
  var autoRunnerStopPromise: Promise<void> | undefined;
}

const AUTO_SEARCH_SCORING_OVERRIDE: Record<
  AutoSearchScoringMode,
  ScoringMode | undefined
> = {
  profile: "profile",
  inherit: undefined,
};

// Pure function — exported for unit tests. Returns the most recent cron
// occurrence at or before `now`. Used in tick() to detect a due cron slot
// without relying on computeNextRun, which always returns a future time.
export function cronPrevFire(
  cronExpression: string,
  now = new Date(),
): Date | null {
  if (!isValidCronExpression(cronExpression)) return null;
  try {
    return CronExpressionParser.parse(cronExpression, { currentDate: now })
      .prev()
      .toDate();
  } catch {
    return null;
  }
}

// Pure function — exported for unit tests. Returns the next scheduled fire
// time given the instance's scheduling config. Returns null for invalid cron.
//
// Interval: lastRunAt=null → epoch (fires immediately on first enable).
// Cron:     lastRunAt=null → next calendar match after `now` (calendar
//           contract — no immediate fire when the user first enables).
export function computeNextRun({
  mode,
  intervalMinutes,
  cronExpression,
  lastRunAt,
  now = new Date(),
}: {
  mode: "interval" | "cron";
  intervalMinutes: number;
  cronExpression: string;
  lastRunAt: Date | null;
  now?: Date;
}): Date | null {
  if (mode === "interval") {
    const base = lastRunAt ? lastRunAt.getTime() : 0;
    return new Date(base + intervalMinutes * 60 * 1000);
  }
  if (!isValidCronExpression(cronExpression)) return null;
  try {
    return CronExpressionParser.parse(cronExpression, { currentDate: now })
      .next()
      .toDate();
  } catch {
    return null;
  }
}

// Builds the derived status payload for a single instance. Used by both the
// per-instance GET route and the bulk statuses route so the shape is always
// consistent. Reads live running state from the singleton autoRunner — must
// be called server-side only.
// Grace window before a not-yet-fired scheduled tick is flagged "overdue".
// Setting this above the scheduler's own scheduleNext drift threshold avoids
// false positives from sub-second timer wake-up jitter.
export const OVERDUE_GRACE_MS = 60_000;

// Consecutive failed ticks before the dashboard tier flips to "critical".
export const FAILED_STREAK_CRITICAL_THRESHOLD = 3;

function computeHealth(
  failedStreak: number,
  overdue: boolean,
): AutoSearchStatus["health"] {
  if (failedStreak >= FAILED_STREAK_CRITICAL_THRESHOLD) return "critical";
  if (overdue) return "warning";
  return "ok";
}

export function buildAutoSearchStatus(
  instance: Instance,
  running: boolean,
): AutoSearchStatus {
  const cronValid = isValidCronExpression(instance.autoSearchCronExpression);

  const rawNextRunAt = instance.autoSearchEnabled
    ? computeNextRun({
        mode: instance.autoSearchScheduleMode,
        intervalMinutes: instance.autoSearchIntervalMinutes,
        cronExpression: instance.autoSearchCronExpression,
        lastRunAt: instance.autoSearchLastRunAt,
      })
    : null;
  // Interval mode with no lastRunAt returns an epoch-based timestamp that is
  // already in the past (fires immediately). Expose null so the client doesn't
  // display a 1970 date.
  const nextRunAt =
    rawNextRunAt && rawNextRunAt.getTime() > Date.now() ? rawNextRunAt : null;

  const pausedUntil = instance.autoSearchPausedUntil
    ? new Date(instance.autoSearchPausedUntil)
    : null;
  const paused = pausedUntil !== null && Date.now() < pausedUntil.getTime();

  // Overdue = scheduled tick is past its window AND we're not currently
  // running and not paused. For cron mode, compare against the most recent
  // cron slot (cronPrevFire) since rawNextRunAt is always future-facing.
  const overdue = (() => {
    if (!instance.autoSearchEnabled || running || paused) return false;
    const now = Date.now();
    if (instance.autoSearchScheduleMode === "cron") {
      const prev = cronPrevFire(instance.autoSearchCronExpression);
      if (!prev) return false;
      const lastRun = instance.autoSearchLastRunAt?.getTime() ?? 0;
      return (
        prev.getTime() > lastRun && now - prev.getTime() > OVERDUE_GRACE_MS
      );
    }
    // Interval mode: when lastRunAt is null, computeNextRun returns
    // epoch + interval — already in the past, but conceptually that's the
    // "first tick is about to fire" sentinel, not a missed run. The user
    // just enabled the schedule; let the runner have its first tick before
    // we surface a warning.
    if (instance.autoSearchLastRunAt === null) return false;
    return (
      rawNextRunAt !== null && now - rawNextRunAt.getTime() > OVERDUE_GRACE_MS
    );
  })();

  const failedStreak = instance.autoSearchFailedStreak;
  // An enabled cron schedule with an invalid expression never fires — surface
  // that as critical instead of a misleading green "ok" badge (#23).
  const cronBroken =
    instance.autoSearchEnabled &&
    instance.autoSearchScheduleMode === "cron" &&
    !cronValid;
  const health = cronBroken ? "critical" : computeHealth(failedStreak, overdue);

  return {
    enabled: instance.autoSearchEnabled,
    scheduleMode: instance.autoSearchScheduleMode,
    intervalMinutes: instance.autoSearchIntervalMinutes,
    cronExpression: instance.autoSearchCronExpression,
    cronValid,
    batchLimit: instance.autoSearchBatchLimit,
    monitoredOnly: instance.autoSearchMonitoredOnly,
    scope: instance.autoSearchScope,
    lastRunAt: instance.autoSearchLastRunAt?.toISOString() ?? null,
    nextRunAt: nextRunAt?.toISOString() ?? null,
    running,
    paused,
    pausedUntil: paused ? pausedUntil!.toISOString() : null,
    cooldownHours: instance.autoSearchCooldownHours,
    scoringMode: instance.autoSearchScoringMode,
    overdue,
    failedStreak,
    health,
  };
}

// Pure picker — exported for unit tests. `scoreOf` must be signed
// (use SCORE_FOR[mode] so profile mode reaches negative-penalty items
// — scoreProfileCoverage clamps to [0,1] and would collapse them).
export function pickAutoSearchBatch<T extends { id: number }>(
  items: T[],
  lastSearchedMap: Map<number, { at: Date; failed: boolean }>,
  batchLimit: number,
  strategy: "balanced" | "random" = "balanced",
  cooldownMs: number = 0,
  scoreOf: (item: T) => number = () => 0,
): T[] {
  const now = Date.now();
  const eligible =
    cooldownMs > 0
      ? items.filter((item) => {
          const info = lastSearchedMap.get(item.id);
          // Never searched or previously failed → always eligible.
          if (!info || info.failed) return true;
          return now - info.at.getTime() > cooldownMs;
        })
      : items;

  const backfill: T[] = [];
  const rest: T[] = [];
  for (const item of eligible) {
    const info = lastSearchedMap.get(item.id);
    if (!info || info.failed) backfill.push(item);
    else rest.push(item);
  }
  backfill.sort((a, b) => scoreOf(a) - scoreOf(b));

  let sortedRest: T[];
  if (strategy === "random") {
    sortedRest = [...rest];
    for (let i = sortedRest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sortedRest[i], sortedRest[j]] = [sortedRest[j], sortedRest[i]];
    }
  } else {
    sortedRest = [...rest].sort((a, b) => {
      const aT = lastSearchedMap.get(a.id)!.at.getTime();
      const bT = lastSearchedMap.get(b.id)!.at.getTime();
      if (aT !== bT) return aT - bT;
      return scoreOf(a) - scoreOf(b);
    });
  }

  return [...backfill, ...sortedRest].slice(0, Math.max(0, batchLimit));
}

// Disjoint buckets for the "mixed" scope: missing (no file), flagged-
// penalty (has file, negative customFormatScore), upgrade (has file,
// flagged, score >= 0). Clean items return null and never participate.
export type MixedBucket = "missing" | "flagged-penalty" | "upgrade";

export function categorizeForMixed<
  T extends {
    existingFileCount: number;
    flagged: boolean;
    customFormatScore: number;
  },
>(item: T): MixedBucket | null {
  if (item.existingFileCount === 0) return "missing";
  // Unflagged items never participate, even with a negative score.
  if (!item.flagged) return null;
  if (item.customFormatScore < 0) return "flagged-penalty";
  return "upgrade";
}

// Round-robin `batchLimit` slots across buckets in urgency order, then
// spill overflow forward (missing → flagged-penalty → upgrade).
// Upgrade does not loop back: lower-urgency buckets must never expand
// into higher-urgency slots.
export function allocateMixedQuota(
  batchLimit: number,
  available: Record<MixedBucket, number>,
): Record<MixedBucket, number> {
  const order: MixedBucket[] = ["missing", "flagged-penalty", "upgrade"];
  const quota: Record<MixedBucket, number> = {
    missing: 0,
    "flagged-penalty": 0,
    upgrade: 0,
  };
  for (let i = 0; i < batchLimit; i++) quota[order[i % 3]]++;

  // Spill leftovers in urgency order.
  for (let i = 0; i < order.length; i++) {
    const bucket = order[i];
    const overflow = quota[bucket] - available[bucket];
    if (overflow > 0) {
      quota[bucket] = available[bucket];
      const next = order[i + 1];
      if (next) quota[next] += overflow;
    }
  }
  return quota;
}

export function pickAutoSearchMixedBatch<
  T extends {
    id: number;
    existingFileCount: number;
    flagged: boolean;
    customFormatScore: number;
  },
>(
  items: T[],
  lastSearchedMap: Map<number, { at: Date; failed: boolean }>,
  batchLimit: number,
  strategy: "balanced" | "random" = "balanced",
  cooldownMs: number = 0,
  scoreOf: (item: T) => number = () => 0,
): T[] {
  const buckets: Record<MixedBucket, T[]> = {
    missing: [],
    "flagged-penalty": [],
    upgrade: [],
  };
  for (const item of items) {
    const b = categorizeForMixed(item);
    if (b !== null) buckets[b].push(item);
  }

  // Two-pass: pre-filter each bucket through pickAutoSearchBatch
  // (applies cooldown), allocate quota from the POST-COOLDOWN counts,
  // then slice. Without this, a bucket whose raw size is N but whose
  // eligible size is 0 steals slots that can't be filled.
  const order: MixedBucket[] = ["missing", "flagged-penalty", "upgrade"];
  const eligible: Record<MixedBucket, T[]> = {
    missing: pickAutoSearchBatch(
      buckets.missing,
      lastSearchedMap,
      Number.MAX_SAFE_INTEGER,
      strategy,
      cooldownMs,
      scoreOf,
    ),
    "flagged-penalty": pickAutoSearchBatch(
      buckets["flagged-penalty"],
      lastSearchedMap,
      Number.MAX_SAFE_INTEGER,
      strategy,
      cooldownMs,
      scoreOf,
    ),
    upgrade: pickAutoSearchBatch(
      buckets.upgrade,
      lastSearchedMap,
      Number.MAX_SAFE_INTEGER,
      strategy,
      cooldownMs,
      scoreOf,
    ),
  };
  const quota = allocateMixedQuota(batchLimit, {
    missing: eligible.missing.length,
    "flagged-penalty": eligible["flagged-penalty"].length,
    upgrade: eligible.upgrade.length,
  });
  return order.flatMap((bucket) => eligible[bucket].slice(0, quota[bucket]));
}

class AutoRunner {
  private timers = new Map<number, SchedulerHandle>();
  private processing = new Set<number>();
  private generations = new Map<number, number>();
  // Dedupe: only log invalid-cron once per continuous invalid period.
  private loggedInvalidCron = new Set<number>();
  private started = false;
  private startPromise: Promise<void> | null = null;
  // In-flight tick promises. setTimeout fires tick() without an awaiter, so
  // without this set a stop() call (e.g. between tests) returns before the
  // tick's DB writes settle and a subsequent setup's truncation transaction
  // collides with them. stop() drains this set before clearing state.
  private inFlight = new Set<Promise<void>>();

  // Scheduler is injected so tests can swap the real timers for an inert
  // (integration tests) or fake-timer-driven (this runner's own tests) one.
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
    // HMR: in dev, a previous runner's async stop() may still be draining.
    // Wait for it before populating timers, otherwise the old runner's
    // in-flight ticks race against the new one's state.
    if (process.env.NODE_ENV !== "production") {
      const pending = globalThis.autoRunnerStopPromise;
      if (pending) {
        await pending;
        globalThis.autoRunnerStopPromise = undefined;
      }
    }
    const instances = await instanceRepository.findAllEnabled();
    for (const inst of instances) {
      if (inst.autoSearchEnabled) this.register(inst);
    }
    this.started = true;
    appLogger.info("Auto-runner started", {
      source: LogSource.AutoRun,
      context: {
        instances: instances.filter((i) => i.autoSearchEnabled).length,
        pid: process.pid,
      },
    });
  }

  async stop(): Promise<void> {
    for (const handle of this.timers.values())
      this.scheduler.clearTimeout(handle);
    this.timers.clear();
    this.generations.clear();
    this.loggedInvalidCron.clear();
    this.started = false;
    // Drain in-flight ticks before clearing `processing` so a tick mid-
    // fanOut doesn't keep writing to the DB after stop() returns. Callers
    // (tests, HMR) treat stop() as a synchronization point.
    if (this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight]);
    }
    // Second sweep: a tick that was already mid-execution when we
    // entered stop() can have called scheduleNext() during the drain
    // (e.g. via an early-return branch in tick that reschedules), which
    // populates this.timers AFTER the first clear. Clear again before
    // declaring the runner truly quiescent.
    for (const handle of this.timers.values())
      this.scheduler.clearTimeout(handle);
    this.timers.clear();
    this.processing.clear();
  }

  async refresh(instanceId: number): Promise<void> {
    const handle = this.timers.get(instanceId);
    if (handle) this.scheduler.clearTimeout(handle);
    this.timers.delete(instanceId);
    this.loggedInvalidCron.delete(instanceId);

    const instance = await instanceRepository.findById(instanceId);
    if (instance && instance.enabled && instance.autoSearchEnabled) {
      this.register(instance);
    } else {
      this.cleanup(instanceId);
    }
  }

  async runNow(instanceId: number): Promise<{ enqueued: number }> {
    if (this.processing.has(instanceId)) {
      throw Object.assign(new Error("Auto-search already running"), {
        code: "AUTO_RUN_BUSY",
      });
    }
    const instance = await instanceRepository.findById(instanceId);
    if (!instance || !instance.enabled || !instance.autoSearchEnabled) {
      throw Object.assign(new Error("Instance not eligible for auto-search"), {
        code: "AUTO_RUN_INELIGIBLE",
      });
    }
    this.processing.add(instanceId);
    try {
      let result: { enqueued: number };
      // fanOut owns the failed-streak outcome — only its rejection counts
      // as a failed tick. Bookkeeping rejections are logged + swallowed
      // so a transient DB blip doesn't falsely bump the streak (and risk
      // flipping health to "critical" after enough success-then-glitch
      // tries) or mask a real fanOut success from the caller.
      try {
        result = await this.fanOut(instance);
      } catch (err) {
        try {
          await instanceRepository.bumpFailedStreak(instanceId);
        } catch (bookkeepingErr) {
          appLogger.error("Auto-runner runNow streak-bump failed", {
            source: LogSource.AutoRun,
            err: bookkeepingErr,
            context: { instanceId },
          });
        }
        throw err;
      }
      try {
        await instanceRepository.stampLastRunAt(instanceId, new Date());
        await instanceRepository.resetFailedStreak(instanceId);
      } catch (bookkeepingErr) {
        appLogger.error("Auto-runner runNow bookkeeping failed", {
          source: LogSource.AutoRun,
          err: bookkeepingErr,
          context: { instanceId },
        });
      }
      return result;
    } finally {
      this.processing.delete(instanceId);
    }
  }

  isRunning(instanceId: number): boolean {
    return this.processing.has(instanceId);
  }

  // Registers a new setTimeout chain for an instance. Bumps the generation
  // token so any prior chain aborts before scheduling another timer.
  private register(instance: Instance): void {
    const instanceId = instance.id;
    const gen = (this.generations.get(instanceId) ?? 0) + 1;
    this.generations.set(instanceId, gen);

    const firstNext = computeNextRun({
      mode: instance.autoSearchScheduleMode,
      intervalMinutes: instance.autoSearchIntervalMinutes,
      cronExpression: instance.autoSearchCronExpression,
      lastRunAt: instance.autoSearchLastRunAt,
    });
    const delay = firstNext ? Math.max(0, firstNext.getTime() - Date.now()) : 0;
    this.scheduleNext(instanceId, gen, delay);
  }

  // Single tick implementation — called by every scheduled timer. Re-reads
  // the instance from DB so config changes propagate without a restart.
  private async tick(instanceId: number, gen: number): Promise<void> {
    if (this.generations.get(instanceId) !== gen) return;

    if (this.processing.has(instanceId)) {
      this.scheduleNext(instanceId, gen, 60_000);
      return;
    }

    const inst = await instanceRepository.findById(instanceId);
    if (!inst || !inst.enabled || !inst.autoSearchEnabled) {
      this.cleanup(instanceId);
      return;
    }

    // Pause: schedule a wake-up at the resume time and skip the tick.
    if (inst.autoSearchPausedUntil) {
      const resumeAt = new Date(inst.autoSearchPausedUntil).getTime();
      if (Date.now() < resumeAt) {
        this.scheduleNext(instanceId, gen, resumeAt - Date.now() + 1000);
        return;
      }
    }

    const now = new Date();
    const next = computeNextRun({
      mode: inst.autoSearchScheduleMode,
      intervalMinutes: inst.autoSearchIntervalMinutes,
      cronExpression: inst.autoSearchCronExpression,
      lastRunAt: inst.autoSearchLastRunAt,
      now,
    });

    if (!next) {
      if (!this.loggedInvalidCron.has(instanceId)) {
        this.loggedInvalidCron.add(instanceId);
        appLogger.warn("Auto-runner: invalid cron — sitting idle", {
          source: LogSource.AutoRun,
          context: {
            instanceId,
            instanceName: inst.name,
            cronExpression: inst.autoSearchCronExpression,
          },
        });
      }
      return;
    }

    // For cron mode, computeNextRun always returns a future time (next
    // calendar match), so msUntilNext is always positive — we'd never fire.
    // Instead, check whether a cron slot has passed since the last run.
    const overdue =
      inst.autoSearchScheduleMode === "cron"
        ? (() => {
            const prev = cronPrevFire(inst.autoSearchCronExpression, now);
            return (
              prev !== null &&
              (inst.autoSearchLastRunAt === null ||
                prev.getTime() > inst.autoSearchLastRunAt.getTime())
            );
          })()
        : next.getTime() <= now.getTime();

    if (!overdue) {
      this.scheduleNext(
        instanceId,
        gen,
        Math.max(0, next.getTime() - now.getTime()),
      );
      return;
    }

    await this.runOnce(inst);

    if (this.generations.get(instanceId) !== gen) return;

    const after = computeNextRun({
      mode: inst.autoSearchScheduleMode,
      intervalMinutes: inst.autoSearchIntervalMinutes,
      cronExpression: inst.autoSearchCronExpression,
      lastRunAt: new Date(),
    });
    if (after) {
      this.scheduleNext(
        instanceId,
        gen,
        Math.max(0, after.getTime() - Date.now()),
      );
    }
  }

  // Scheduled-tick wrapper around fanOut. Owns the processing lock,
  // lastRunAt stamp, and failed-streak bookkeeping. runNow() bypasses this
  // because it surfaces errors to the caller; ticks swallow them so the
  // chain keeps rescheduling.
  private async runOnce(inst: Instance): Promise<void> {
    // Hold the per-instance lock across BOTH fanOut and the bookkeeping
    // writes. Releasing in fanOut's finally would let a concurrent
    // runNow() slip into the gap and race stampLastRunAt /
    // bumpFailedStreak — that can lose a failed-streak update or stamp
    // an older lastRunAt over the newer one.
    this.processing.add(inst.id);
    try {
      let tickError: unknown;
      let bookkeepingError: unknown;
      try {
        await this.fanOut(inst);
      } catch (err) {
        tickError = err;
      }

      // Bookkeeping split into two try-catches so a transient
      // stampLastRunAt failure doesn't skip the failed-streak update —
      // the streak counter drives the "instance keeps failing" alert
      // path and silently leaving it stale is worse than missing one
      // lastRunAt heartbeat. Both errors funnel into a single log
      // below.
      try {
        await instanceRepository.stampLastRunAt(inst.id, new Date());
      } catch (err) {
        bookkeepingError = err;
      }
      try {
        if (tickError) {
          await instanceRepository.bumpFailedStreak(inst.id);
        } else {
          await instanceRepository.resetFailedStreak(inst.id);
        }
      } catch (err) {
        bookkeepingError = bookkeepingError ?? err;
      }

      // Merged failure log — one event per tick, with both error
      // causes (if any) attached. Avoids the "which failure is real"
      // confusion when both fire.
      if (tickError || bookkeepingError) {
        appLogger.error("Auto-runner tick failed", {
          source: LogSource.AutoRun,
          err: tickError ?? bookkeepingError,
          context: {
            instanceId: inst.id,
            instanceName: inst.name,
            tickFailed: !!tickError,
            bookkeepingFailed: !!bookkeepingError,
            ...(tickError && bookkeepingError
              ? { bookkeepingError: String(bookkeepingError) }
              : {}),
          },
        });
      }
    } finally {
      this.processing.delete(inst.id);
    }
  }

  private async fanOut(inst: Instance): Promise<{ enqueued: number }> {
    const service = mediaServiceFor(inst.type);
    const scoringModeOverride =
      AUTO_SEARCH_SCORING_OVERRIDE[inst.autoSearchScoringMode];

    const { items: rawItems } = await service.getItems(inst.id, {
      page: 1,
      limit: 5000,
      sortBy: "score",
      order: "asc",
      // `mixed` needs the wider net so missing-file items reach the
      // bucket splitter; narrower scopes filter upstream for efficiency.
      flaggedOnly:
        inst.autoSearchScope === "flagged" ||
        inst.autoSearchScope === "upgrade",
      monitorStatus: inst.autoSearchMonitoredOnly ? "monitored" : "all",
      // scope === "missing" → keep only items with no existing file
      // (`existingFileCount === 0`). Severity "missing" is the canonical
      // server-side encoding of that predicate.
      severities: inst.autoSearchScope === "missing" ? ["missing"] : undefined,
      scoringModeOverride,
    });

    // "upgrade" = flagged items that already have a file. No query-layer
    // filter for "has file"; apply post-fetch via existingFileCount.
    const items: MediaItem[] =
      inst.autoSearchScope === "upgrade"
        ? rawItems.filter((item: MediaItem) => item.existingFileCount > 0)
        : rawItems;

    const lastSearched = await logRepository.findLastSearchedAtByMedia(inst.id);
    const effectiveMode: ScoringMode = scoringModeOverride ?? inst.scoringMode;
    // Missing-file items resolve to -Infinity so they outrank every
    // finite negative score. (compareMedia sinks them to the bottom
    // for page display; the picker needs the opposite.)
    const baseScore = SCORE_FOR[effectiveMode];
    const scoreOf = (item: MediaItem): number =>
      item.existingFileCount === 0 ? Number.NEGATIVE_INFINITY : baseScore(item);
    const picked =
      inst.autoSearchScope === "mixed"
        ? pickAutoSearchMixedBatch(
            items,
            lastSearched,
            inst.autoSearchBatchLimit,
            inst.autoSearchPickStrategy,
            inst.autoSearchCooldownHours * 60 * 60 * 1000,
            scoreOf,
          )
        : pickAutoSearchBatch(
            items,
            lastSearched,
            inst.autoSearchBatchLimit,
            inst.autoSearchPickStrategy,
            inst.autoSearchCooldownHours * 60 * 60 * 1000,
            scoreOf,
          );

    if (picked.length === 0) {
      appLogger.info("Auto-runner tick — no eligible items", {
        source: LogSource.AutoRun,
        context: {
          instanceId: inst.id,
          instanceName: inst.name,
          total: items.length,
        },
      });
      return { enqueued: 0 };
    }

    // Skip items already sitting in the pending queue so enqueued counts
    // only net-new rows and the runner doesn't hammer the same items twice.
    const alreadyPending = new Set(
      (await searchQueueRepository.findPendingByInstance(inst.id)).map(
        (p) => p.mediaId,
      ),
    );
    const toEnqueue = picked.filter((item) => !alreadyPending.has(item.id));

    const groupId = toEnqueue.length > 1 ? crypto.randomUUID() : undefined;
    const action = ARR_META[inst.type].defaultBatchAction;
    let enqueued = 0;

    for (const item of toEnqueue) {
      try {
        await searchQueueService.enqueue({
          instance: inst,
          action,
          mediaId: item.id,
          title: item.title,
          groupId,
        });
        enqueued++;
      } catch (err) {
        appLogger.error("Auto-runner enqueue failed", {
          source: LogSource.AutoRun,
          err,
          context: {
            instanceId: inst.id,
            mediaId: item.id,
            title: item.title,
            enqueuedSoFar: enqueued,
            batchSize: toEnqueue.length,
          },
        });
      }
    }

    appLogger.info("Auto-runner tick complete", {
      source: LogSource.AutoRun,
      context: {
        instanceId: inst.id,
        instanceName: inst.name,
        picked: picked.length,
        enqueued,
        batchLimit: inst.autoSearchBatchLimit,
        scope: inst.autoSearchScope,
      },
    });
    return { enqueued };
  }

  private scheduleNext(instanceId: number, gen: number, delayMs: number): void {
    const handle = this.scheduler.setTimeout(() => {
      const work = this.tick(instanceId, gen);
      this.inFlight.add(work);
      // Catch BEFORE finally so an unexpected rejection bubbling out of
      // tick() (or its bookkeeping) is logged + swallowed instead of
      // crashing the process or producing an unhandled-rejection. The
      // scheduling chain re-arms itself inside tick() so we just need to
      // not leak; the next register/refresh restarts the chain if a
      // truly fatal error escaped.
      void work
        .catch((err) =>
          appLogger.error("Auto-runner tick promise rejected", {
            source: LogSource.AutoRun,
            err,
            context: { instanceId },
          }),
        )
        .finally(() => this.inFlight.delete(work));
    }, delayMs);
    this.timers.set(instanceId, handle);
  }

  private cleanup(instanceId: number): void {
    const handle = this.timers.get(instanceId);
    if (handle) this.scheduler.clearTimeout(handle);
    this.timers.delete(instanceId);
    this.generations.delete(instanceId);
  }
}

// HMR singleton — same pattern as status-poller and search-worker.
// stop() is async (drains in-flight ticks); we can't await at module init,
// so the prior runner's stop promise is stashed on globalThis and awaited
// at the top of start() instead. Without this, HMR can race a new runner
// against the old one's still-draining ticks.
//
// In dev, ALWAYS construct a fresh AutoRunner when a previous one exists,
// then hand off via stopPromise + startInternal()'s await. Reusing the
// previous reference (the obvious `previousAutoRunner ?? new AutoRunner()`)
// makes the stop/swap branch ref-identical and therefore unreachable,
// which silently kept the old timer chain alive across reloads.
const previousAutoRunner = globalThis.autoRunner;
const isDev = process.env.NODE_ENV !== "production";
export const autoRunner =
  previousAutoRunner && !isDev ? previousAutoRunner : new AutoRunner();
if (isDev) {
  if (previousAutoRunner && previousAutoRunner !== autoRunner) {
    globalThis.autoRunnerStopPromise = previousAutoRunner.stop();
  }
  globalThis.autoRunner = autoRunner;
}
