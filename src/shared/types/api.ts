import type {
  ActionLog,
  ArrType,
  AutoSearchPickStrategy,
  AutoSearchScheduleMode,
  AutoSearchScope,
  AutoSearchScoringMode,
} from "./models";

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
  showAllMedia?: boolean;
  autoSearchEnabled?: boolean;
  autoSearchScheduleMode?: AutoSearchScheduleMode;
  autoSearchIntervalMinutes?: number;
  autoSearchCronExpression?: string;
  autoSearchBatchLimit?: number;
  autoSearchMonitoredOnly?: boolean;
  autoSearchScope?: AutoSearchScope;
  autoSearchPickStrategy?: AutoSearchPickStrategy;
  autoSearchCooldownHours?: number;
  autoSearchPausedUntil?: string | null;
  autoSearchScoringMode?: AutoSearchScoringMode;
};

/**
 * Shape sent to the browser. Never includes apiKey — that's a server-only secret.
 */
export interface PublicInstance {
  id: number;
  type: ArrType;
  name: string;
  url: string;
  enabled: boolean;
  scoringMode: "manual" | "profile";
  searchesPerHour: number;
  showAllMedia: boolean;
  createdAt: string | Date;
  autoSearchEnabled: boolean;
  autoSearchScheduleMode: AutoSearchScheduleMode;
  autoSearchIntervalMinutes: number;
  autoSearchCronExpression: string;
  autoSearchBatchLimit: number;
  autoSearchLastRunAt: string | Date | null;
  autoSearchMonitoredOnly: boolean;
  autoSearchScope: AutoSearchScope;
  autoSearchPickStrategy: AutoSearchPickStrategy;
  autoSearchCooldownHours: number;
  autoSearchPausedUntil: string | Date | null;
  autoSearchScoringMode: AutoSearchScoringMode;
}

export interface AutoSearchStatus {
  enabled: boolean;
  scheduleMode: AutoSearchScheduleMode;
  intervalMinutes: number;
  cronExpression: string;
  cronValid: boolean;
  batchLimit: number;
  monitoredOnly: boolean;
  scope: AutoSearchScope;
  lastRunAt: string | null;
  nextRunAt: string | null;
  running: boolean;
  paused: boolean;
  pausedUntil: string | null;
  cooldownHours: number;
  scoringMode: AutoSearchScoringMode;
  // True when nextRunAt was due more than OVERDUE_GRACE_MS ago but the
  // tick hasn't fired yet (clock drift, system sleep, missed window).
  overdue: boolean;
  // Number of consecutive ticks that threw during fan-out. Reset on the
  // first successful tick. health === "critical" once this hits 3.
  failedStreak: number;
  // Aggregated indicator for dashboard badge color:
  //   "ok"        — healthy
  //   "warning"   — overdue
  //   "critical"  — failedStreak >= FAILED_STREAK_CRITICAL_THRESHOLD
  health: "ok" | "warning" | "critical";
}

export interface CronPreviewResponse {
  next: string[];
}

// Wire shape returned by the search routes when an action is queued for
// the search worker. Manual searches always queue (live OR dry-run); the
// worker writes the dry_run ActionLog row when it drains in dry-run
// mode. `isDryRun` lets the client pick the right toast variant.
export interface QueuedSearchResponse {
  queued: true;
  queueId: number;
  isDryRun: boolean;
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
  autoSearchEnabled: boolean;
  autoSearchLastRunAt: string | null;
  // null when the media cache is cold for this instance — the dashboard
  // avoids triggering an expensive build inline. The route fires a
  // background warm; counts appear on the next dashboard refetch.
  // Rendered as "{flaggedCount} / {totalCount}" on the dashboard.
  flaggedCount: number | null;
  totalCount: number | null;
  failedActionsCount: number;
  hasPreferences: boolean;
}

// Aggregated counts across every enabled instance of each *arr type.
// `flagged*` and `total*` are null when at least one enabled instance of
// that type is still cold — the dashboard renders "—" instead of "0" so
// the cold state doesn't masquerade as "all clear". Resolves once every
// enabled instance warms. The dashboard renders
// "{flaggedMovies} / {totalMovies}" (and same for series) so the user
// sees how much of the library is flagged.
export interface DashboardTotals {
  flaggedMovies: number | null;
  totalMovies: number | null;
  flaggedSeries: number | null;
  totalSeries: number | null;
  failedActions24h: number;
}

export interface DashboardSummary {
  perInstance: DashboardInstanceSummary[];
  totals: DashboardTotals;
  recentActivity: ActionLog[];
}
