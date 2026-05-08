import type { ActionLog, ArrType, ScoringMode } from "@/shared/types/models";
import { movieService } from "./MovieService";
import { seriesService } from "./SeriesService";

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

// Cross-type service surface used by routes that branch on a media
// instance's arr type. MovieService and SeriesService both implement this;
// callers go through mediaServiceFor(inst.type) instead of hard-coding
// `inst.type === "radarr" ? movieService : seriesService`.
export type MediaRouteService = MediaCacheService & RetryableMediaService;

export interface RetryActionOptions {
  actionLogId?: number;
  // Hex UUID linking sibling rows from one bulk submission. Persisted
  // on the resulting ActionLog.groupId so the History UI can collapse
  // them. Single-item invocations / retries leave this undefined.
  groupId?: string;
}

// Type-keyed registry of arr type → media service. Mirrors the established
// ArrClientFactory pattern for HTTP clients.
const services = {
  radarr: movieService,
  sonarr: seriesService,
} satisfies Record<ArrType, MediaRouteService>;

export function mediaServiceFor(arrType: ArrType): MediaRouteService {
  return services[arrType];
}
