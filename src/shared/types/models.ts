export type Severity = "critical" | "low" | "warning" | "ok" | "missing";
export type ArrType = "radarr" | "sonarr";
export type ScoringMode = "manual" | "profile";
export type ActionType =
  | "search"
  | "search_season"
  | "search_episode"
  | "delete"
  | "ignore";
export type ActionStatus = "success" | "failed" | "dry_run" | "pending";
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
  createdAt: Date;
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
  profileIds?: number[];
  severities?: Severity[];
  missingCfIds?: number[];
  missingCfMatch?: "any" | "all";
  hasNegativeCfIds?: number[];
  hasNegativeCfMatch?: "any" | "all";
  onlyMissing?: boolean;
  // Default `true` (preserves the original "flagged items only"
  // contract). Set `false` for the "Show all" library view.
  flaggedOnly?: boolean;
  // Default `"all"` — no monitor filter.
  monitorStatus?: MonitorStatus;
}

export interface FlaggedMedia {
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

export interface FlaggedMovie extends FlaggedMedia {
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

export interface FlaggedSeries extends FlaggedMedia {
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
  createdAt: Date;
  processedAt: Date | null;
  seasonNumber: number;
  fileId: number;
}
