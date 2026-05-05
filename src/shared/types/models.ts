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

export interface MediaQuery {
  page: number;
  limit: number;
  sortBy: "score" | "title" | "added" | "size";
  order: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number;
  missingCfIds?: number[];
  missingCfMatch?: "any" | "all";
  hasNegativeCfIds?: number[];
  hasNegativeCfMatch?: "any" | "all";
  onlyMissing?: boolean;
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
