import crypto from "crypto";
import { CronExpressionParser } from "cron-parser";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { logRepository } from "@/server/repositories/LogRepository";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { mediaServiceFor } from "@/server/services/media-services";
import type {
  ArrType,
  AutoSearchScoringMode,
  Instance,
  MediaItem,
  ScoringMode,
} from "@/shared/types/models";
import { appLogger } from "./app-logger";
import { LogSource } from "./log-sources";

const AUTO_SEARCH_SCORING_OVERRIDE: Record<
  AutoSearchScoringMode,
  ScoringMode | undefined
> = {
  profile: "profile",
  inherit: undefined,
};

const QUEUE_ACTIONS: Record<ArrType, "movie" | "series"> = {
  radarr: "movie",
  sonarr: "series",
};

// Pure function — exported for unit tests. Returns the most recent cron
// occurrence at or before `now`. Used in tick() to detect a due cron slot
// without relying on computeNextRun, which always returns a future time.
export function cronPrevFire(
  cronExpression: string,
  now = new Date(),
): Date | null {
  try {
    const fields = cronExpression.trim().split(/\s+/);
    if (fields.length !== 5) return null;
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
  try {
    const fields = cronExpression.trim().split(/\s+/);
    if (fields.length !== 5) return null;
    return CronExpressionParser.parse(cronExpression, { currentDate: now })
      .next()
      .toDate();
  } catch {
    return null;
  }
}

// Pure picker — exported for unit tests.
//
// Backfill items (never searched OR last search failed) always come first,
// sorted by worst cfScore. Remaining slots are filled by strategy:
//   "balanced" — oldest lastSearchedAt first, cfScore as tie-breaker.
//   "random"   — random shuffle of the remainder.
export function pickAutoSearchBatch<T extends { id: number; cfScore: number }>(
  items: T[],
  lastSearchedMap: Map<number, { at: Date; failed: boolean }>,
  batchLimit: number,
  strategy: "balanced" | "random" = "balanced",
  cooldownMs: number = 0,
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
  backfill.sort((a, b) => a.cfScore - b.cfScore);

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
      return a.cfScore - b.cfScore;
    });
  }

  return [...backfill, ...sortedRest].slice(0, Math.max(0, batchLimit));
}

class AutoRunner {
  private timers = new Map<number, NodeJS.Timeout>();
  private processing = new Set<number>();
  private generations = new Map<number, number>();
  // Dedupe: only log invalid-cron once per continuous invalid period.
  private loggedInvalidCron = new Set<number>();
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

  stop(): void {
    for (const handle of this.timers.values()) clearTimeout(handle);
    this.timers.clear();
    this.processing.clear();
    this.generations.clear();
    this.loggedInvalidCron.clear();
    this.started = false;
  }

  async refresh(instanceId: number): Promise<void> {
    const handle = this.timers.get(instanceId);
    if (handle) clearTimeout(handle);
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
      const result = await this.fanOut(instance);
      await instanceRepository.stampLastRunAt(instanceId, new Date());
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

    this.processing.add(instanceId);
    try {
      await this.fanOut(inst);
    } catch (err) {
      appLogger.error("Auto-runner tick failed", {
        source: LogSource.AutoRun,
        err,
        context: { instanceId, instanceName: inst.name },
      });
    } finally {
      this.processing.delete(instanceId);
    }

    await instanceRepository.stampLastRunAt(instanceId, new Date());

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

  private async fanOut(inst: Instance): Promise<{ enqueued: number }> {
    const service = mediaServiceFor(inst.type);
    const scoringModeOverride =
      AUTO_SEARCH_SCORING_OVERRIDE[inst.autoSearchScoringMode];

    const { items: rawItems } = await service.getItems(inst.id, {
      page: 1,
      limit: 5000,
      sortBy: "score",
      order: "asc",
      flaggedOnly:
        inst.autoSearchScope === "flagged" ||
        inst.autoSearchScope === "upgrade",
      monitorStatus: inst.autoSearchMonitoredOnly ? "monitored" : "all",
      onlyMissing: inst.autoSearchScope === "missing" ? true : undefined,
      scoringModeOverride,
    });

    // "upgrade" = flagged items that already have a file. No query-layer
    // filter for "has file"; apply post-fetch via existingFileCount.
    const items: MediaItem[] =
      inst.autoSearchScope === "upgrade"
        ? rawItems.filter((item: MediaItem) => item.existingFileCount > 0)
        : rawItems;

    const lastSearched = await logRepository.findLastSearchedAtByMedia(inst.id);
    const picked = pickAutoSearchBatch(
      items,
      lastSearched,
      inst.autoSearchBatchLimit,
      inst.autoSearchPickStrategy,
      inst.autoSearchCooldownHours * 60 * 60 * 1000,
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
    const action = QUEUE_ACTIONS[inst.type];
    let enqueued = 0;

    for (const item of toEnqueue) {
      try {
        await searchQueueService.enqueue({
          instanceId: inst.id,
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
          context: { instanceId: inst.id, mediaId: item.id, title: item.title },
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
    const handle = setTimeout(() => {
      void this.tick(instanceId, gen);
    }, delayMs);
    handle.unref?.();
    this.timers.set(instanceId, handle);
  }

  private cleanup(instanceId: number): void {
    const handle = this.timers.get(instanceId);
    if (handle) clearTimeout(handle);
    this.timers.delete(instanceId);
    this.generations.delete(instanceId);
  }
}

// HMR singleton — same pattern as status-poller and search-worker.
const globalForAutoRunner = globalThis as unknown as {
  autoRunner?: AutoRunner;
};
const previousAutoRunner = globalForAutoRunner.autoRunner;
export const autoRunner = previousAutoRunner ?? new AutoRunner();
if (process.env.NODE_ENV !== "production") {
  if (previousAutoRunner && previousAutoRunner !== autoRunner) {
    previousAutoRunner.stop();
  }
  globalForAutoRunner.autoRunner = autoRunner;
}
