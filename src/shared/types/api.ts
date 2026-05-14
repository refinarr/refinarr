import type {
  ActionLog,
  ActionStatus,
  ActionType,
  AppLogEntry,
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

// Per-group aggregate sent alongside the paginated /api/history response so
// a batch's header reads "Batch · search · 100 items / 3 failed" even when
// the 100 children span multiple paginated pages. Counts include the
// in-memory pending queue rows synthesized by the route, so a fresh bulk
// op shows its full size immediately instead of trickling in.
export interface GroupSummary {
  groupId: string;
  total: number;
  // Per-status counts — keys are sparse (only present statuses appear).
  // Pending counts here include both queued-but-not-dispatched rows and
  // any ActionLog rows that have a `pending` status.
  statusCounts: Partial<Record<ActionStatus, number>>;
  action: ActionType;
}

// Augments PaginatedResponse for /api/history specifically. Distinct shape
// so the type contract for callers that don't need group context (e.g.
// retry mutations) stays simple.
export interface HistoryResponse extends PaginatedResponse<ActionLog> {
  // Map keyed by groupId — entries exist only for groups that have at
  // least one row referenced on the current page (kept compact so the
  // payload doesn't balloon on a quiet instance).
  groupSummaries: Record<string, GroupSummary>;
}

// Canonical JSON error shape returned by createApiHandler. `traceId` is
// always present (UUID per request) so a 500 reported by a user can be
// correlated to the appLogger row that captured the stack.
export interface ApiErrorResponse {
  error: string;
  code?: string;
  traceId: string;
}

// Server-pushed events delivered over the SSE channel. Shared because
// the client subscribes through `src/client/lib/event-channel.ts` —
// keeping the type in `src/server/` would force a forbidden
// server→client import. Canonical home for BOTH ends: server emit
// sites (`src/server/lib/event-bus.ts`, `src/app/api/events/route.ts`,
// `src/app/api/logs/stream/route.ts`) and the client subscriber
// import this file directly. No re-export shim — keep it that way
// per the project's no-re-export-shim rule.
export type ServerEvent =
  | { type: "queue-changed"; instanceId: number }
  | { type: "queue-cleared"; instanceId: number }
  | { type: "history-changed"; instanceId: number }
  | { type: "applog"; entry: AppLogEntry };

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

// Read-only info shown on /settings/system. Composed from
// build-info.ts + github-release.ts on the server; the client
// renders it verbatim and pairs auth info from useMe().
export interface SystemInfo {
  version: string;
  // Absolute ts (not "age in ms") so the client can call
  // formatRelative() directly — keeps Date.now() out of render
  // bodies, which eslint-plugin-react-hooks's purity rule flags.
  bootedAtMs: number;
  node: string;
  platform: string;
  latestRelease: LatestReleaseInfo | null;
}

export interface LatestReleaseInfo {
  tag: string;
  htmlUrl: string;
  checkedAtMs: number;
  // True when this came from a stale cache (last fetch >6h ago AND a
  // fresh fetch failed). The UI dims the badge to signal "may not be
  // current".
  isStale: boolean;
}

// Lives here (not in data-cache.ts) so the client `useCacheStats` hook
// can import the type without dragging in the server module — keeps
// the layer boundary clean.
export interface CacheStatsSnapshot {
  entries: number;
  maxEntries: number;
  sizeBytes: number;
  maxSizeBytes: number;
  hits: number;
  misses: number;
  // Only counts true LRU/size overflow — explicit invalidate() / clear()
  // is NOT an eviction even though it removes entries.
  evictions: number;
  inflightCount: number;
  // Absolute timestamp (not "age in ms") so the client can call
  // formatRelative() directly — keeps `Date.now()` out of render
  // bodies, which eslint-plugin-react-hooks's purity rule flags.
  oldestEntryAtMs: number | null;
  lastInvalidatedAtMs: number | null;
}

export interface ClearDiagnosticsCacheResponse {
  ok: boolean;
}
