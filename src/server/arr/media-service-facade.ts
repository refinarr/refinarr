// Facade contract for cross-arr media services. The Facade Pattern in
// classical OO hides multiple subsystems behind one narrow interface;
// here the facade is the role both MovieService and SeriesService play
// when consumed by code that doesn't care which arr it's talking to
// (dashboard summary, retry route, status poller).
//
// Concrete implementations (MovieService, SeriesService) live in
// `@/server/services/`; the per-arr lookup (mediaServiceFor,
// createArrClient, ARR_META, movieService, seriesService) lives next
// door in `@/server/arr/composition`. This file is type-only — no
// runtime export — so it can't form a cycle with the composition
// root that references these types.
import type {
  ActionLog,
  MediaItem,
  MediaQuery,
  ScoringMode,
} from "@/shared/types/models";

export interface MediaCacheService {
  /**
   * Returns the flagged-item count from cache if warm, or null if cold.
   * Used by the dashboard summary route's "X flagged" numerator.
   */
  getCachedFlaggedCount(instanceId: number, mode: ScoringMode): number | null;

  /**
   * Returns the total cached item count (visible-library size) if warm,
   * or null if cold. Used by the dashboard summary route's "/ Y"
   * denominator.
   */
  getCachedTotalCount(instanceId: number, mode: ScoringMode): number | null;

  /**
   * Fires a minimal getMovies/getSeries call to warm the cache. Used as
   * fire-and-forget by the dashboard route when the cache is cold.
   */
  warmMediaCache(instanceId: number): Promise<unknown>;

  /**
   * Fetches items through the service layer (cache + query). Callers that
   * need arr-type-agnostic item access (e.g. auto-runner) use this instead
   * of hard-coding getMovies / getSeries branches.
   */
  getItems(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: MediaItem[]; total: number }>;
}

export interface RetryableMediaService {
  /**
   * Re-runs an ActionLog payload (search / delete). Each service knows how
   * to parse its own payload shape (movies use `fileId`, series use
   * `fileIds`). Throws if the action type isn't retryable; the retry
   * route maps that to a 400.
   */
  retryFromPayload(
    payload: Record<string, unknown>,
    opts?: RetryActionOptions,
  ): Promise<ActionLog>;
}

// The facade surface used by routes that branch on a media instance's
// arr type. MovieService and SeriesService both implement this; callers
// go through mediaServiceFor(inst.type) instead of hard-coding
// `inst.type === "radarr" ? movieService : seriesService`.
//
// Composed from the two capability interfaces above via intersection so
// the file can grow a third capability (e.g. a future SearchableMediaService)
// without touching the implementation classes — they pick up the new
// methods automatically once added to either capability.
export type MediaServiceFacade = MediaCacheService & RetryableMediaService;

export interface RetryActionOptions {
  actionLogId?: number;
  // Hex UUID linking sibling rows from one bulk submission. Persisted
  // on the resulting ActionLog.groupId so the History UI can collapse
  // them. Single-item invocations / retries leave this undefined.
  groupId?: string;
}
