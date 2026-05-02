export type Severity = "critical" | "low" | "warning" | "ok" | "missing";
export type ArrType = "radarr" | "sonarr";
export type ScoringMode = "manual" | "profile";
export type ActionType = "search" | "delete" | "ignore";
export type ActionStatus = "success" | "failed" | "dry_run" | "pending";
export type MediaType = "movie" | "series";

export interface Instance {
  id: number;
  type: ArrType;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
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

export interface FlaggedMovie {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  movieFileId: number;
  customFormats: CustomFormat[];
  customFormatScore: number;
  hasFile: boolean;
  cfScore: number;
  missingFormats: CustomFormat[];
  unwantedFormats: CustomFormat[];
  minProfileScore?: number;
  sizeOnDisk: number;
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

export interface FlaggedSeries {
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
  affectedEpisodeCount: number;
  totalEpisodeCount: number;
  episodeFiles: EpisodeFileEntry[];
  sizeOnDisk: number;
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
