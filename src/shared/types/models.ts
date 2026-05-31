export type Severity = "critical" | "low" | "warning" | "ok" | "missing";
export type ArrType = "radarr" | "sonarr";

export const LogSource = {
  Api: "api",
  Client: "client",
  Auth: "auth",
  Db: "db",
  ArrClient: "arr-client",
  InstanceService: "instance-service",
  MovieService: "movie-service",
  SeriesService: "series-service",
  MediaAction: "media-action",
  SearchQueue: "search-queue",
  SearchWorker: "search-worker",
  StatusPoller: "status-poller",
  AutoRun: "auto-run",
} as const;
export type LogSource = (typeof LogSource)[keyof typeof LogSource];
export type ScoringMode = "manual" | "profile";
export type AutoSearchScheduleMode = "interval" | "cron";
export type AutoSearchScope =
  | "missing"
  | "upgrade"
  | "flagged"
  | "all"
  | "mixed";
export type AutoSearchPickStrategy = "balanced" | "random";
export type AutoSearchScoringMode = "inherit" | "profile";
export type ActionType =
  | "search"
  | "search_season"
  | "search_episode"
  | "delete"
  | "ignore";
// Forward-only status flow.
//
// Search-type actions (search / search_season / search_episode):
//   pending → searched → grabbed → downloaded
// "searched" means the search command was queued upstream (POST
// /command returned 2xx) — NOT that the indexer found anything. The
// later lifecycle states are populated by the statusPoller once it
// observes the corresponding /history events upstream.
//
// Non-search actions (delete / ignore):
//   pending → success
// These have no post-dispatch lifecycle, so "success" stays accurate.
//
// dry_run / failed are terminal for both flows.
export type ActionStatus =
  | "success"
  | "searched"
  | "failed"
  | "dry_run"
  | "pending"
  | "grabbed"
  | "downloaded";
export type MediaType = "movie" | "series";

export interface Instance {
  id: number;
  type: ArrType;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  scoringMode: ScoringMode;
  searchesPerHour: number;
  // Per-instance opt-in for "Advanced — show all media". When false
  // (default), the API serves flagged-only items even if the request
  // asks for `flaggedOnly=false`. When true, the page-level toggle
  // becomes available so the user can view/search/delete non-flagged
  // items too. Recommended OFF; surfaced like dryRun (deliberate
  // opt-in with a warning).
  showAllMedia: boolean;
  createdAt: Date;
  autoSearchEnabled: boolean;
  autoSearchScheduleMode: AutoSearchScheduleMode;
  autoSearchIntervalMinutes: number;
  autoSearchCronExpression: string;
  autoSearchBatchLimit: number;
  autoSearchLastRunAt: Date | null;
  autoSearchMonitoredOnly: boolean;
  autoSearchScope: AutoSearchScope;
  autoSearchPickStrategy: AutoSearchPickStrategy;
  autoSearchCooldownHours: number;
  autoSearchPausedUntil: Date | null;
  autoSearchScoringMode: AutoSearchScoringMode;
  autoSearchFailedStreak: number;
}

export interface CustomFormat {
  id: number;
  name: string;
  score?: number;
}

export interface QualityProfile {
  id: number;
  name: string;
  minUpgradeFormatScore: number;
  cutoffFormatScore: number;
  formatItems: Array<{ format: number; name: string; score: number }>;
}

// Item state in the *arr-monitor / file-presence axis. Composes
// orthogonally with the CF-flagging filter so the user can ask for
// "monitored items only", "items with at least one missing file",
// etc. — independent of whether they're CF-flagged.
export type MonitorStatus = "all" | "monitored" | "unmonitored" | "missing";

export interface MediaQuery {
  page: number;
  limit: number;
  sortBy: "score" | "title" | "added" | "size";
  order: "asc" | "desc";
  // Score range — bounds depend on scoring mode (manual: 0..1; profile:
  // raw integer score). Both omitted means "no filter".
  minScore?: number;
  maxScore?: number;
  // Size range in bytes. Both omitted means "no filter".
  minSize?: number;
  maxSize?: number;
  q?: string;
  // Exact-match filter on the radarr/sonarr media id. Used by
  // history/dashboard deep-links (`?mediaId=<id>`) so the landed page
  // shows precisely the linked item, not a fuzzy title-match list.
  // Nullable so the client's `null` sentinel survives the round-trip
  // (forQuery passes MediaFilters straight through).
  mediaId?: number | null;
  profileIds?: number[];
  severities?: Severity[];
  missingCfIds?: number[];
  missingCfMatch?: "any" | "all";
  hasNegativeCfIds?: number[];
  hasNegativeCfMatch?: "any" | "all";
  // Default `true` (preserves the original "flagged items only"
  // contract). Set `false` for the "Show all" library view.
  flaggedOnly?: boolean;
  // Default `"all"` — no monitor filter.
  monitorStatus?: MonitorStatus;
  // When set, overrides the instance's own scoringMode for this query only.
  // Used by auto-runner when autoSearchScoringMode = "profile" on a
  // manual-mode instance so it picks candidates by cutoff, not CF coverage.
  scoringModeOverride?: ScoringMode;
}

export interface MediaItem {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  customFormats: CustomFormat[];
  customFormatScore: number;
  cfScore: number;
  missingFormats: CustomFormat[];
  unwantedFormats: CustomFormat[];
  minProfileScore?: number;
  sizeOnDisk: number;
  // Whether the *arr is tracking this item for new releases. Surfaced
  // upstream by every *arr fork; we pass it through verbatim so the UI
  // can render the monitor indicator and the user can filter by it.
  monitored: boolean;
  // File counts derived from the upstream payload. For movies this is
  // 0/1 from `hasFile`. For series it's `sum(seasons[].statistics.
  // episodeFileCount)` and `sum(seasons[].statistics.episodeCount)`.
  // An item is considered "missing" when monitored && existingFileCount
  // < totalFileCount.
  existingFileCount: number;
  totalFileCount: number;
  // True when the item satisfies the mode-appropriate flagging predicate
  // (manual: missing wanted CFs; profile: below cutoff). Computed once
  // at build time so the cache holds every visible item and the
  // `flaggedOnly` query filter can include or exclude non-flagged rows
  // without rebuilding.
  flagged: boolean;
}

export interface MovieItem extends MediaItem {
  movieFileId: number;
  hasFile: boolean;
}

export interface EpisodeFileEntry {
  id: number;
  seasonNumber: number;
  relativePath: string;
  customFormats: CustomFormat[];
  customFormatScore: number;
  missingFormats: CustomFormat[];
  unwantedFormats: CustomFormat[];
  minProfileScore?: number;
  size: number;
}

export interface SeriesItem extends MediaItem {
  affectedEpisodeCount: number;
  totalEpisodeCount: number;
  episodeFiles: EpisodeFileEntry[];
}

export interface ActionLog {
  id: number;
  instanceId: number;
  action: ActionType;
  mediaId: number;
  title: string;
  isDryRun: boolean;
  status: ActionStatus;
  error?: string | null;
  payload?: string | null;
  // Hex UUID linking sibling rows from one bulk action. Null for
  // single-item actions (renders flat in history).
  groupId?: string | null;
  // Upstream Radarr/Sonarr command id captured from the dispatch
  // response. Per-item; used as the join key for future lifecycle
  // status updates (webhook / polling).
  commandId?: number | null;
  // Command-sync poll result — the upstream command's
  // body.completionMessage (e.g. "0 releases found", "Sent 1
  // release(s)..."). On current Servarr versions that leave the field
  // null, statusPoller falls back to synthesizing "No releases
  // grabbed" from the absence of a grab event. Null until either
  // path observes the command finishing.
  completionMessage?: string | null;
  // Captured from the /history `grabbed` event when the lifecycle poller
  // advances the row to `grabbed`. `sourceTitle` is the grabbed release
  // name shown in History; `downloadId` is the download-client handle.
  // Both null until a grab is observed.
  sourceTitle?: string | null;
  downloadId?: string | null;
  createdAt: Date;
  lastRetriedAt?: Date | null;
}

export interface CfPreference {
  id: number;
  instanceId: number;
  cfId: number;
  cfName: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppLogEntry {
  id: number;
  level: LogLevel;
  message: string;
  source: string | null;
  context: string | null;
  // Lifted from `context.instanceId` at insert time so the /logs viewer
  // can filter by instance without scanning the JSON column. Null when
  // the originating log didn't carry an instanceId (auth, db, etc.).
  instanceId: number | null;
  createdAt: Date;
}

export interface IgnoreEntry {
  id: number;
  instanceId: number;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  ignoredAt: Date;
}

export type SearchQueueAction = "movie" | "series" | "season" | "episode";
export type SearchQueueStatus = "pending" | "done" | "failed";

export interface SearchQueueEntry {
  id: number;
  instanceId: number;
  action: SearchQueueAction;
  mediaId: number;
  payload: string;
  title: string;
  status: SearchQueueStatus;
  error: string | null;
  // Propagated to ActionLog.groupId on drain. Null for single-item
  // searches.
  groupId: string | null;
  createdAt: Date;
  processedAt: Date | null;
  // Per-action disambiguator computed at enqueue time by the owning
  // per-arr module's `dedupKey(action, payload)`. Drives the partial
  // UNIQUE INDEX `SearchQueue_pending_dedup`. See
  // `src/server/arr/definition.ts` (ArrDefinition.dedupKey) and
  // `src/server/arr/composition.ts` (dedupKeyFor).
  dedupKey: string;
}
