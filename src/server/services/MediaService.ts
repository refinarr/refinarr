import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { logRepository } from "@/server/repositories/LogRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import type { ArrClient } from "@/server/clients/ArrClient";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";
import {
  dataCache,
  CACHE_STALE_MS,
  CACHE_TTL_MS,
} from "@/server/lib/DataCache";
import { SCORE_FOR } from "@/shared/scoring-mode";
import { getSeverity } from "@/shared/severity";
import type {
  ActionLog,
  ActionType,
  CustomFormat,
  FlaggedMedia,
  Instance,
  MediaQuery,
  ScoringMode,
} from "@/shared/types/models";
import { dryRunService } from "./DryRunService";

interface ExecuteActionOptions {
  instanceId: number;
  instanceName: string;
  action: ActionType;
  mediaId: number;
  title: string;
  actionLogId?: number;
  payload?: Record<string, unknown>;
  run: () => Promise<void>;
}

interface ReadWithSwrOptions<TCached> {
  cacheKey: string;
  instanceId: number;
  logSource: LogSource;
  backgroundErrorMessage: string;
  build: () => Promise<TCached>;
}

// Single source for the human-readable log subject — keeps [DryRun],
// success, and error messages consistent (action: title [instanceName]).
function describe(opts: ExecuteActionOptions): string {
  return `${opts.action}: ${opts.title} [${opts.instanceName}]`;
}

function logContext(opts: ExecuteActionOptions, isDryRun: boolean) {
  return {
    action: opts.action,
    mediaId: opts.mediaId,
    title: opts.title,
    instanceId: opts.instanceId,
    instanceName: opts.instanceName,
    isDryRun,
    ...(opts.actionLogId ? { actionLogId: opts.actionLogId } : {}),
  };
}

// True iff the item has at least one file on disk. Replaces the
// per-subclass `hasFile` callback that used to be threaded through
// applyQuery / compareMedia / getSeverity. Field-based check fixes the
// long-standing bug where a Sonarr series with 1-of-100 episodes
// downloaded reported `hasFile=true`.
function itemHasFile(item: FlaggedMedia): boolean {
  return item.existingFileCount > 0;
}

function compareMedia<T extends FlaggedMedia>(
  a: T,
  b: T,
  sortBy: MediaQuery["sortBy"],
  mode: ScoringMode,
  dir: 1 | -1,
): number {
  if (sortBy === "added") return 0;
  if (sortBy === "title") return a.title.localeCompare(b.title) * dir;
  // Items without a file sink to the bottom regardless of sort direction so
  // the "worst N" view is never polluted by entries with no on-disk reference.
  const aHas = itemHasFile(a);
  const bHas = itemHasFile(b);
  if (aHas !== bHas) return aHas ? -1 : 1;
  if (!aHas) return 0;
  if (sortBy === "score") {
    const av = SCORE_FOR[mode](a);
    const bv = SCORE_FOR[mode](b);
    return (av - bv) * dir;
  }
  return (a.sizeOnDisk - b.sizeOnDisk) * dir;
}

// Match a list of CF ids against the CFs an item carries on a given
// axis (missingFormats / unwantedFormats). Used twice in `applyQuery`
// — extracted here so the per-axis filter is a single line at the
// call site and applyQuery's cognitive-complexity stays under threshold.
function filterByCfList<T extends FlaggedMedia>(
  items: T[],
  wanted: number[],
  match: "any" | "all",
  axis: (item: T) => CustomFormat[],
): T[] {
  const matchAll = match === "all";
  return items.filter((m) => {
    const have = new Set(axis(m).map((cf) => cf.id));
    return matchAll
      ? wanted.every((id) => have.has(id))
      : wanted.some((id) => have.has(id));
  });
}

// Three small filter passes split by axis so each function stays under
// the cognitive-complexity threshold and applyQuery's pipeline reads as
// a sequence of named steps.
function filterMedia<T extends FlaggedMedia>(
  source: T[],
  query: MediaQuery,
  mode: ScoringMode,
): T[] {
  const visibility = applyVisibilityFilters(source, query);
  const ranges = applyRangeFilters(visibility, query, mode);
  return applyMatchFilters(ranges, query);
}

// Show-or-hide filters: flagged-only, monitor status, only-missing.
// Drive what enters the user's view (vs. composing on the score axis).
function applyVisibilityFilters<T extends FlaggedMedia>(
  source: T[],
  query: MediaQuery,
): T[] {
  let out = source;
  // Default-on flagged-only filter preserves the original contract
  // ("flagged items only"). Set query.flaggedOnly === false for
  // "Show all".
  if (query.flaggedOnly !== false) out = out.filter((m) => m.flagged);
  if (query.monitorStatus && query.monitorStatus !== "all") {
    const status = query.monitorStatus;
    out = out.filter((m) => matchesMonitor(m, status));
  }
  if (query.onlyMissing) out = out.filter((m) => !itemHasFile(m));
  return out;
}

// Numeric / enum ranges: score, size, severity. All evaluate a per-item
// scalar against the query bounds.
function applyRangeFilters<T extends FlaggedMedia>(
  source: T[],
  query: MediaQuery,
  mode: ScoringMode,
): T[] {
  const scoreOf = SCORE_FOR[mode];
  let out = source;
  if (query.minScore !== undefined) {
    const min = query.minScore;
    out = out.filter((m) => scoreOf(m) >= min);
  }
  if (query.maxScore !== undefined) {
    const max = query.maxScore;
    out = out.filter((m) => scoreOf(m) <= max);
  }
  if (query.minSize !== undefined) {
    const min = query.minSize;
    out = out.filter((m) => m.sizeOnDisk >= min);
  }
  if (query.maxSize !== undefined) {
    const max = query.maxSize;
    out = out.filter((m) => m.sizeOnDisk <= max);
  }
  if (query.severities && query.severities.length > 0) {
    const wanted = new Set(query.severities);
    out = out.filter((m) =>
      wanted.has(
        getSeverity(scoreOf(m), m.minProfileScore, mode, itemHasFile(m)),
      ),
    );
  }
  return out;
}

// Identity / set-membership filters: query string, profile ids, CF lists.
function applyMatchFilters<T extends FlaggedMedia>(
  source: T[],
  query: MediaQuery,
): T[] {
  let out = source;
  if (query.q) {
    const q = query.q.toLowerCase();
    out = out.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.missingFormats.some((cf) => cf.name.toLowerCase().includes(q)),
    );
  }
  if (query.profileIds && query.profileIds.length > 0) {
    const wanted = new Set(query.profileIds);
    out = out.filter((m) => wanted.has(m.qualityProfileId));
  }
  if (query.missingCfIds && query.missingCfIds.length > 0) {
    out = filterByCfList(
      out,
      query.missingCfIds,
      query.missingCfMatch ?? "all",
      (m) => m.missingFormats,
    );
  }
  if (query.hasNegativeCfIds && query.hasNegativeCfIds.length > 0) {
    out = filterByCfList(
      out,
      query.hasNegativeCfIds,
      query.hasNegativeCfMatch ?? "all",
      (m) => m.unwantedFormats,
    );
  }
  return out;
}

// Predicate matching a MediaQuery `monitorStatus` value against an item's
// monitor + file-count state. "missing" means monitored AND at least one
// expected file is absent.
function matchesMonitor(
  item: FlaggedMedia,
  status: NonNullable<MediaQuery["monitorStatus"]>,
): boolean {
  switch (status) {
    case "all":
      return true;
    case "monitored":
      return item.monitored;
    case "unmonitored":
      return !item.monitored;
    case "missing":
      return item.monitored && item.existingFileCount < item.totalFileCount;
  }
}

export abstract class MediaService<TFlagged extends FlaggedMedia> {
  protected abstract readonly cacheNamespace: string;

  protected abstract getFlaggedForWarm(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: TFlagged[]; total: number }>;

  protected flaggedCacheKey(instanceId: number, mode: ScoringMode): string {
    return `${this.cacheNamespace}:${instanceId}:${mode}`;
  }

  getCachedFlaggedTotal(instanceId: number, mode: ScoringMode): number | null {
    const cached = dataCache.get<{ flagged: TFlagged[] }>(
      this.flaggedCacheKey(instanceId, mode),
      CACHE_TTL_MS,
    );
    return cached?.flagged.length ?? null;
  }

  warmFlaggedCache(instanceId: number): Promise<unknown> {
    return this.getFlaggedForWarm(instanceId, {
      page: 1,
      limit: 1,
      sortBy: "score",
      order: "asc",
    });
  }

  protected async readWithSwr<TCached>({
    cacheKey,
    instanceId,
    logSource,
    backgroundErrorMessage,
    build,
  }: ReadWithSwrOptions<TCached>): Promise<TCached> {
    const result = dataCache.getWithStaleness<TCached>(
      cacheKey,
      CACHE_TTL_MS,
      CACHE_STALE_MS,
    );

    if (result.kind === "fresh") {
      appLogger.debug("Cache hit", {
        source: logSource,
        context: { cacheKey },
      });
      return result.value;
    }

    if (result.kind === "stale") {
      // Serve cached data immediately and refresh in the background. The
      // dataCache.rebuild guard ensures concurrent stale reads share one
      // rebuild rather than firing parallel upstream calls.
      if (!dataCache.isRebuilding(cacheKey)) {
        void dataCache.rebuild(cacheKey, build).catch((err) => {
          appLogger.error(backgroundErrorMessage, {
            source: logSource,
            err,
            context: { instanceId, cacheKey },
          });
        });
      }
      return result.value;
    }

    // Miss — block on rebuild. Concurrent miss callers share the same
    // promise via dataCache.rebuild.
    return dataCache.rebuild(cacheKey, build);
  }

  // Resolves an instance + creates its ArrClient, the boilerplate every
  // action method (`triggerSearch`, `deleteFile`, etc.) used to repeat
  // verbatim. Generic so callers that need an arr-specific client
  // (`SonarrClient` for `triggerSeasonSearch`, etc.) can narrow with
  // `withClient<SonarrClient>(...)`. Defaults to the abstract `ArrClient`
  // base for action methods that only use cross-arr operations.
  protected async withClient<TClient extends ArrClient = ArrClient>(
    instanceId: number,
  ): Promise<{ instance: Instance; client: TClient }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as TClient;
    return { instance, client };
  }

  protected applyQuery<T extends FlaggedMedia>(
    source: T[],
    query: MediaQuery,
    mode: ScoringMode,
  ): { items: T[]; total: number } {
    const filtered = filterMedia(source, query, mode);
    const dir = query.order === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) =>
      compareMedia(a, b, query.sortBy, mode, dir),
    );
    const total = sorted.length;
    const start = (query.page - 1) * query.limit;
    return { items: sorted.slice(start, start + query.limit), total };
  }

  protected async executeAction(
    opts: ExecuteActionOptions,
  ): Promise<ActionLog> {
    const isDryRun = await dryRunService.isDryRun();

    const logData = {
      instanceId: opts.instanceId,
      action: opts.action,
      mediaId: opts.mediaId,
      title: opts.title,
      isDryRun,
      status: isDryRun ? "dry_run" : "pending",
      error: null,
      payload: opts.payload ? JSON.stringify(opts.payload) : null,
    } satisfies Omit<ActionLog, "id" | "createdAt" | "lastRetriedAt">;

    // Retry path keeps the original createdAt so the History UI can show
    // "Failed Mar 3 · Retried Mar 5". lastRetriedAt drives the sort so
    // the row floats to the top of recent activity without losing the
    // first-failure timestamp.
    const logEntry = opts.actionLogId
      ? await logRepository.update(opts.actionLogId, {
          ...logData,
          lastRetriedAt: new Date(),
        })
      : await logRepository.create(logData);

    if (isDryRun) {
      appLogger.info(`[DryRun] ${describe(opts)}`, {
        source: LogSource.MediaAction,
        context: logContext(opts, true),
      });
      return logEntry;
    }

    try {
      await opts.run();
      // Bust the flagged-media cache so the UI sees the post-action state on
      // the next read (deleted/searched item gone) instead of the previous
      // 5-minute snapshot. Dry runs and failed actions don't invalidate —
      // upstream state didn't change.
      dataCache.invalidate(opts.instanceId);
      appLogger.info(`[Run] ${describe(opts)}`, {
        source: LogSource.MediaAction,
        context: logContext(opts, false),
      });
      return logRepository.update(logEntry.id, { status: "success" });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      appLogger.error(`Media action failed: ${describe(opts)}`, {
        source: LogSource.MediaAction,
        err,
        context: logContext(opts, false),
      });
      return logRepository.update(logEntry.id, { status: "failed", error });
    }
  }
}
