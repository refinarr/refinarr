import type { ActionLog, ArrType, ScoringMode } from "@/shared/types/models";
import { movieService } from "./MovieService";
import { seriesService } from "./SeriesService";

export interface FlaggedCacheService {
  /**
   * Returns the flagged-count from cache if warm, or null if cold. Used by
   * the dashboard summary route to avoid triggering a multi-second
   * upstream build inline.
   */
  getCachedFlaggedTotal(instanceId: number, mode: ScoringMode): number | null;

  /**
   * Fires a minimal getFlagged* call to warm the cache. Used as
   * fire-and-forget by the dashboard route when the cache is cold.
   */
  warmFlaggedCache(instanceId: number): Promise<unknown>;
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
export type MediaRouteService = FlaggedCacheService & RetryableMediaService;

export interface RetryActionOptions {
  actionLogId?: number;
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
