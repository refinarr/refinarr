import type { ActionLog, ArrType } from "./models";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Canonical JSON error shape returned by createApiHandler. `traceId` is
// always present (UUID per request) so a 500 reported by a user can be
// correlated to the appLogger row that captured the stack.
export interface ApiErrorResponse {
  error: string;
  code?: string;
  traceId: string;
}

// Client-side error report payload for /api/logs/client. Shape mirrors
// what reportClientError in src/client/lib/client-error-logger.ts beacons
// when fetch fails or a 5xx comes back.
export interface ClientErrorReportDto {
  message: string;
  path: string;
  method?: string;
  status?: number;
  code?: string;
  traceId?: string;
  stack?: string;
  component?: string;
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
    // null when at least one enabled instance of that type is still cold —
    // the dashboard renders "—" instead of "0" so the cold state doesn't
    // masquerade as "all clear". Resolves once every enabled instance warms.
    flaggedMovies: number | null;
    flaggedSeries: number | null;
    failedActions24h: number;
  };
  recentActivity: ActionLog[];
}
