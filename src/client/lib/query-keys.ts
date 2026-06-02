import type { ArrType } from "@/shared/types/models";

export const queryKeys = {
  instances: () => ["instances"] as const,
  instance: (id: number) => ["instances", id] as const,
  instanceHealth: (id: number) => ["instance-health", id] as const,
  me: () => ["me"] as const,
  movies: (instanceId: number, params?: object) =>
    ["movies", instanceId, params] as const,
  moviesAll: (instanceId: number) => ["movies", instanceId] as const,
  series: (instanceId: number, params?: object) =>
    ["series", instanceId, params] as const,
  seriesAll: (instanceId: number) => ["series", instanceId] as const,
  config: () => ["config"] as const,
  ignore: (instanceId: number) => ["ignore", instanceId] as const,
  history: (params?: object) => ["history", params] as const,
  historyAll: () => ["history"] as const,
  historyErrors: (instanceId: number) =>
    ["history", "errors", instanceId] as const,
  qualityProfiles: (type: ArrType, instanceId: number) =>
    ["qualityProfiles", type, instanceId] as const,
  customFormats: (type: ArrType, instanceId: number) =>
    ["customFormats", type, instanceId] as const,
  health: () => ["health"] as const,
  appLogs: (params?: object) => ["appLogs", params] as const,
  dashboardSummary: () => ["dashboard-summary"] as const,
  searchQueue: (instanceId: number) => ["search-queue", instanceId] as const,
  searchQueueAll: () => ["search-queue", "all"] as const,
  recentSearches: (instanceId: number) =>
    ["recent-searches", instanceId] as const,
  autoSearchStatus: (instanceId: number) =>
    ["auto-search-status", instanceId] as const,
  autoSearchStatuses: () => ["auto-search-statuses"] as const,
  cronPreview: (expr: string) => ["cron-preview", expr] as const,
  diagnosticsCache: () => ["diagnostics", "cache"] as const,
  system: () => ["system"] as const,
};
