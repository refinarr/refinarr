import type { ActionLog, ArrType } from "./models";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface CreateInstanceDto {
  type: ArrType;
  name: string;
  url: string;
  apiKey: string;
  enabled?: boolean;
  searchesPerHour?: number;
}

export type UpdateInstanceDto = Partial<CreateInstanceDto> & {
  scoringMode?: "manual" | "profile";
};

/**
 * Shape sent to the browser. Never includes apiKey — that's a server-only secret.
 */
export interface InstanceListItem {
  id: number;
  type: ArrType;
  name: string;
  url: string;
  enabled: boolean;
  scoringMode: "manual" | "profile";
  searchesPerHour: number;
  createdAt: string | Date;
}

export interface SetConfigDto {
  key: string;
  value: string;
}

export interface SetPreferencesDto {
  instanceId: number;
  cfs: Array<{ cfId: number; cfName: string }>;
}

export interface BulkActionDto {
  instanceId: number;
  mediaIds: number[];
  action: "search" | "delete" | "ignore";
}

export interface HistoryQuery {
  instanceId?: number;
  status?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export interface DashboardInstanceSummary {
  id: number;
  type: ArrType;
  name: string;
  enabled: boolean;
  // null when the flagged-media cache is cold for this instance — the
  // dashboard avoids triggering an expensive build inline. The route fires
  // a background warm; counts appear on the next dashboard refetch.
  flaggedCount: number | null;
  failedActionsCount: number;
  hasPreferences: boolean;
}

export interface DashboardSummary {
  perInstance: DashboardInstanceSummary[];
  totals: {
    flaggedMovies: number;
    flaggedSeries: number;
    failedActions24h: number;
  };
  recentActivity: ActionLog[];
}
