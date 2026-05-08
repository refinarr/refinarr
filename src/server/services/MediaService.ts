import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { logRepository } from "@/server/repositories/LogRepository";
import {
  ArrClientFactory,
  type ClientFor,
} from "@/server/clients/ArrClientFactory";
import type { ArrClient } from "@/server/clients/ArrClient";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";
import {
  dataCache,
  CACHE_STALE_MS,
  CACHE_TTL_MS,
} from "@/server/lib/DataCache";
import { isProfileMode, SCORE_FOR } from "@/shared/scoring-mode";
import { getSeverity } from "@/shared/severity";
import type {
  ActionLog,
  ActionType,
  CustomFormat,
  ArrType,
  MediaItem,
  Instance,
  MediaQuery,
  MediaType,
  QualityProfile,
  ScoringMode,
} from "@/shared/types/models";
import { dryRunService } from "./DryRunService";

interface ProfileMaps {
  byId: Map<number, QualityProfile>;
  scoresByProfile: Map<number, Map<number, number>>;
  positiveByProfile: Map<number, CustomFormat[]>;
}

interface DecorateArgs {
  fileCfs: Array<{ id: number; name: string }>;
  cfScoreMap: Map<number, number>;
  positiveProfileCfs: CustomFormat[];
}

interface DecorateResult {
  customFormats: CustomFormat[];
  missingFormats: CustomFormat[];
  unwantedFormats: CustomFormat[];
}

interface ProfileItemContext<TUpstream, TFile> {
  item: TUpstream;
  file: TFile;
  profile: QualityProfile;
  cfScoreMap: Map<number, number>;
  positiveProfileCfs: CustomFormat[];
}

interface ManualItemContext<TUpstream, TFile> {
  item: TUpstream;
  file: TFile;
  profileMaps: ProfileMaps;
  wantedIds: number[];
  wantedCfs: Array<{ id: number; name: string }>;
}

interface BuildPipelineArgs<TUpstream extends UpstreamItem, TFile, TItem> {
  instance: Instance;
  mode: ScoringMode;
  mediaType: MediaType;
  items: TUpstream[];
  profiles: QualityProfile[];
  filesFor: (item: TUpstream) => TFile;
  toProfileItem: (ctx: ProfileItemContext<TUpstream, TFile>) => TItem;
  toManualItem: (ctx: ManualItemContext<TUpstream, TFile>) => TItem;
}

// Minimal shape every *arr upstream item satisfies — used as the
// `extends` constraint on `runBuildPipeline`'s TUpstream so the
// orchestrator can consult `id` + `qualityProfileId` without forcing
// the subclass to thread its concrete payload type through here.
interface UpstreamItem {
  id: number;
  qualityProfileId: number;
}

interface ExecuteActionOptions {
  instanceId: number;
  instanceName: string;
  action: ActionType;
  mediaId: number;
  title: string;
  actionLogId?: number;
  payload?: Record<string, unknown>;
  // UUID linking sibling rows from one bulk submission. Stamped on the
  // ActionLog row at write time. Undefined for single-item dispatches.
  groupId?: string;
  // Run the upstream effect. Optionally returns { commandId } from the
  // *arr response — when present, it's stamped on the ActionLog row
  // alongside the success transition. Non-search actions (delete,
  // ignore) keep returning void.
  run: () => Promise<void | { commandId: number }>;
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
function itemHasFile(item: MediaItem): boolean {
  return item.existingFileCount > 0;
}

function compareMedia<T extends MediaItem>(
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
function filterByCfList<T extends MediaItem>(
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
function filterMedia<T extends MediaItem>(
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
function applyVisibilityFilters<T extends MediaItem>(
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
function applyRangeFilters<T extends MediaItem>(
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
function applyMatchFilters<T extends MediaItem>(
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
  item: MediaItem,
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

export abstract class MediaService<TItem extends MediaItem> {
  protected abstract readonly cacheNamespace: string;

  protected abstract getForWarm(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: TItem[]; total: number }>;

  protected mediaCacheKey(instanceId: number, mode: ScoringMode): string {
    return `${this.cacheNamespace}:${instanceId}:${mode}`;
  }

  // Flagged subset of the cache (per-item `flagged === true`). The
  // dashboard reads this for the "X flagged" KPI; before this PR the
  // method returned `cached.items.length`, which made a 1,000-movie
  // library show as "1,000 flagged" once any item entered the cache.
  //
  // Reads from the full TTL+STALE window so the dashboard count tracks
  // whatever the actual `/api/<arr>/<media>` path would serve. With the
  // strict TTL here, an unrelated mutation (e.g. changing another
  // instance's scoring mode 6 minutes after page load) would cause this
  // instance's KPI to flip to skeleton even though its endpoint still
  // returns data from the SWR stale window.
  getCachedFlaggedCount(instanceId: number, mode: ScoringMode): number | null {
    const cached = dataCache.get<{ items: TItem[] }>(
      this.mediaCacheKey(instanceId, mode),
      CACHE_TTL_MS + CACHE_STALE_MS,
    );
    return cached?.items.filter((m) => m.flagged).length ?? null;
  }

  // Visible-library size (cache row count). Used as the denominator
  // in the dashboard's "X / Y" KPI. Same TTL+STALE window as
  // `getCachedFlaggedCount` so both counts surface or skeleton in lockstep.
  getCachedTotalCount(instanceId: number, mode: ScoringMode): number | null {
    const cached = dataCache.get<{ items: TItem[] }>(
      this.mediaCacheKey(instanceId, mode),
      CACHE_TTL_MS + CACHE_STALE_MS,
    );
    return cached?.items.length ?? null;
  }

  warmMediaCache(instanceId: number): Promise<unknown> {
    return this.getForWarm(instanceId, {
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
  // verbatim.
  //
  // Two call shapes:
  //   `await this.withClient(instanceId)` → `client: ArrClient`,
  //     for cross-arr operations (the abstract surface only).
  //   `await this.withClient(instanceId, "sonarr")` → `client: SonarrClient`,
  //     for arr-specific extras like `triggerSeasonSearch`. The
  //     return-type narrowing comes from the `ClientFor<T>` mapping, so
  //     the consumer doesn't need to import `SonarrClient` at all
  //     (and stays inside the "subclasses constructed only via
  //     ArrClientFactory" rule).
  //
  // The discriminator form runtime-checks `instance.type` against the
  // requested arr type so a misuse (e.g. `withClient(radarrId, "sonarr")`)
  // throws here, not at the first method call. The factory picks the
  // matching client from `instance.type` so the runtime check is
  // equivalent to `instanceof` without needing the subclass at runtime.
  protected withClient(
    instanceId: number,
  ): Promise<{ instance: Instance; client: ArrClient }>;
  protected withClient<T extends ArrType>(
    instanceId: number,
    expectedType: T,
  ): Promise<{ instance: Instance; client: ClientFor<T> }>;
  protected async withClient(
    instanceId: number,
    expectedType?: ArrType,
  ): Promise<{ instance: Instance; client: ArrClient }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    if (expectedType && instance.type !== expectedType) {
      throw new Error(
        `Instance ${instanceId} is type ${instance.type}, expected ${expectedType}`,
      );
    }
    return { instance, client: ArrClientFactory.createArrClient(instance) };
  }

  // Build the three profile-derived maps every *arr build needs:
  //   byId — profile lookup, also used to drop items pointing at a
  //     deleted profile (broken upstream state).
  //   scoresByProfile — per-profile cfId → score, used to enrich
  //     `customFormats` and partition `unwantedFormats`.
  //   positiveByProfile — per-profile profile-rewarded CFs as
  //     `CustomFormat[]` (carrying score), used as the `missingFormats`
  //     candidate set in profile mode.
  protected buildProfileMaps(profiles: QualityProfile[]): ProfileMaps {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const scoresByProfile = new Map<number, Map<number, number>>();
    const positiveByProfile = new Map<number, CustomFormat[]>();
    for (const p of profiles) {
      const cfMap = new Map<number, number>();
      for (const item of p.formatItems) cfMap.set(item.format, item.score);
      scoresByProfile.set(p.id, cfMap);
      positiveByProfile.set(
        p.id,
        p.formatItems
          .filter((item) => item.score > 0)
          .map((item) => ({
            id: item.format,
            name: item.name,
            score: item.score,
          })),
      );
    }
    return { byId, scoresByProfile, positiveByProfile };
  }

  // Resolve the set of media ids the user has marked "ignore" for this
  // instance. Filtered to the caller's mediaType because IgnoreEntry rows
  // share the table across all media types.
  protected async findIgnoredMediaIds(
    instanceId: number,
    mediaType: MediaType,
  ): Promise<Set<number>> {
    const entries = await ignoreRepository.findByInstance(instanceId);
    return new Set(
      entries.filter((e) => e.mediaType === mediaType).map((e) => e.mediaId),
    );
  }

  // Partition a file's CFs into the three shapes downstream code reads:
  //   customFormats — every CF the file carries, enriched with the
  //     profile's score for that CF (so the UI can colour by score).
  //   missingFormats — profile-rewarded CFs the file does NOT carry.
  //   unwantedFormats — CFs the file carries that score < 0 in the profile.
  // Pure function over its inputs; no IO or state.
  protected decorateCustomFormats({
    fileCfs,
    cfScoreMap,
    positiveProfileCfs,
  }: DecorateArgs): DecorateResult {
    const fileCfIds = new Set(fileCfs.map((cf) => cf.id));
    const customFormats: CustomFormat[] = fileCfs.map((cf) => ({
      id: cf.id,
      name: cf.name,
      score: cfScoreMap.get(cf.id),
    }));
    const missingFormats = positiveProfileCfs.filter(
      (cf) => !fileCfIds.has(cf.id),
    );
    const unwantedFormats: CustomFormat[] = fileCfs
      .filter((cf) => (cfScoreMap.get(cf.id) ?? 0) < 0)
      .map((cf) => ({
        id: cf.id,
        name: cf.name,
        score: cfScoreMap.get(cf.id),
      }));
    return { customFormats, missingFormats, unwantedFormats };
  }

  // Template-method orchestrator for the build pipeline. The subclass
  // provides the upstream items + per-item file resolver + per-mode
  // adapters; this method handles the cross-arr concerns:
  //   1. Build profile maps.
  //   2. Skip ignored items.
  //   3. In profile mode: skip items pointing at a deleted profile
  //      (broken upstream state, can't be scored).
  //   4. In manual mode: load wanted-CF prefs once.
  //   5. Dispatch to the per-mode adapter for each visible item.
  //
  // TUpstream / TFile are method-scoped generics so the class itself
  // stays single-generic on TItem (test subclasses don't need to
  // thread types they never use).
  protected async runBuildPipeline<TUpstream extends UpstreamItem, TFile>(
    args: BuildPipelineArgs<TUpstream, TFile, TItem>,
  ): Promise<TItem[]> {
    const { instance, mode, mediaType, items, profiles, filesFor } = args;
    const profileMaps = this.buildProfileMaps(profiles);
    const ignoredSet = await this.findIgnoredMediaIds(instance.id, mediaType);
    const visible = items.filter((i) => !ignoredSet.has(i.id));

    if (isProfileMode(mode)) {
      return visible
        .filter((i) => profileMaps.byId.has(i.qualityProfileId))
        .map((item) => {
          const profile = profileMaps.byId.get(item.qualityProfileId)!;
          const cfScoreMap =
            profileMaps.scoresByProfile.get(item.qualityProfileId) ??
            new Map<number, number>();
          const positiveProfileCfs =
            profileMaps.positiveByProfile.get(item.qualityProfileId) ?? [];
          return args.toProfileItem({
            item,
            file: filesFor(item),
            profile,
            cfScoreMap,
            positiveProfileCfs,
          });
        });
    }

    const prefs = await preferenceRepository.findByInstance(instance.id);
    const wantedIds = prefs.map((p) => p.cfId);
    const wantedCfs = prefs.map((p) => ({ id: p.cfId, name: p.cfName }));

    return visible.map((item) =>
      args.toManualItem({
        item,
        file: filesFor(item),
        profileMaps,
        wantedIds,
        wantedCfs,
      }),
    );
  }

  protected applyQuery<T extends MediaItem>(
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

  // Defense-in-depth normalization. The page-level "Show all" toggle is
  // gated by Instance.showAllMedia — a per-instance opt-in. When the
  // instance has the flag off, force `flaggedOnly = true` regardless of
  // what the request asks. The UI also hides the toggle, but an attacker
  // / curious user with the X-Api-Key could still hit `?flaggedOnly=false`
  // directly; this layer makes the flag a real capability gate.
  protected enforceShowAllMedia(
    query: MediaQuery,
    instance: Instance,
  ): MediaQuery {
    return instance.showAllMedia ? query : { ...query, flaggedOnly: true };
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
      groupId: opts.groupId ?? null,
      commandId: null,
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
      const result = await opts.run();
      // Bust the flagged-media cache so the UI sees the post-action state on
      // the next read (deleted/searched item gone) instead of the previous
      // 5-minute snapshot. Dry runs and failed actions don't invalidate —
      // upstream state didn't change.
      dataCache.invalidate(opts.instanceId);
      appLogger.info(`[Run] ${describe(opts)}`, {
        source: LogSource.MediaAction,
        context: logContext(opts, false),
      });
      // Stamp the upstream commandId when the run returned one (search
      // actions). Delete/ignore return void and leave commandId null.
      const successUpdate: Partial<ActionLog> = { status: "success" };
      if (result && "commandId" in result) {
        successUpdate.commandId = result.commandId;
      }
      return logRepository.update(logEntry.id, successUpdate);
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
