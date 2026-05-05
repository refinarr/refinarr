import type { BulkActionsConfig } from "@/client/hooks/media/useBulkMediaActions";
import type { FlaggedMedia, FlaggedMovie, FlaggedSeries, MediaType } from "@/shared/types/models";

// 1. Define the standard "Base" that every action uses
const createBaseBody = (item: FlaggedMedia, instId: number) => ({
  instanceId: instId,
  mediaId: item.id,
  title: item.title,
});

/**
 * 2. The Optimized Factory
 * We only ask for the things that CHANGE between Movie and Series.
 */
function createBulkConfig<T extends FlaggedMedia>(
  mediaType: MediaType,
  endpoints: { search: string; delete: string },
  logic: { 
    isDeletable: (item: T) => boolean; 
    deleteExtras: (item: T) => Record<string, unknown>;
  }
): Pick<BulkActionsConfig<T>, "mediaType" | "search" | "ignore" | "delete"> {
  return {
    mediaType,
    // Shared Search Logic
    search: {
      endpoint: endpoints.search,
      body: (item, instId) => createBaseBody(item, instId),
    },
    // Standardized Ignore (Identical for all)
    ignore: {
      endpoint: "/ignore",
      body: (item, instId) => ({
        ...createBaseBody(item, instId),
        mediaType,
      }),
    },
    // Shared Delete Logic + Specific Extras
    delete: {
      endpoint: endpoints.delete,
      isDeletable: logic.isDeletable,
      body: (item, instId, search) => ({
        ...createBaseBody(item, instId),
        search,
        ...logic.deleteExtras(item),
      }),
    },
  };
}

// 3. Clean, readable implementations
export const MOVIE_BULK_CONFIG = createBulkConfig<FlaggedMovie>(
  "movie",
  { search: "/radarr/movies/search", delete: "/radarr/movies/delete" },
  { 
    isDeletable: (m) => m.hasFile && m.movieFileId > 0, 
    deleteExtras: (m) => ({ fileId: m.movieFileId }) 
  }
);

export const SERIES_BULK_CONFIG = createBulkConfig<FlaggedSeries>(
  "series",
  { search: "/sonarr/series/search", delete: "/sonarr/series/delete" },
  { 
    isDeletable: (s) => s.episodeFiles.length > 0, 
    deleteExtras: (s) => ({ fileIds: s.episodeFiles.map(f => f.id) }) 
  }
);
