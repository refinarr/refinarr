export type ArrType = "radarr" | "sonarr";
export type ScoringMode = "manual" | "profile";
export type ActionType = "search" | "delete_blacklist" | "ignore";
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
}

export interface QualityProfile {
  id: number;
  name: string;
  minUpgradeFormatScore: number;
}

export interface FlaggedMovie {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  customFormats: CustomFormat[];
  customFormatScore: number;
  hasFile: boolean;
  cfScore: number;
  missingFormats: CustomFormat[];
  scoreDelta?: number;
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
  scoreDelta?: number;
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

export interface IgnoreEntry {
  id: number;
  instanceId: number;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  ignoredAt: Date;
}
