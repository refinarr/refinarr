import type { BulkActionsConfig } from "@/client/hooks/media/useBulkMediaActions";
import type { FlaggedMedia, FlaggedMovie, FlaggedSeries, MediaType } from "@/shared/types/models";

// Per-media-type bulk-action configs. Pages and the future MediaListShell
// import these instead of declaring them inline.
//
// The shared shape (search-by-id body, ignore body, base delete body) lives
// in createBulkConfig. Per-type concerns — search/delete endpoints, the
// "is deletable" predicate, and the type-specific delete body fields
// (movies: fileId; series: fileIds[]) — come in via overrides. Adding a
// third media type (Lidarr / Whisparr) means one more createBulkConfig call.

type Specifics<T extends FlaggedMedia> = {
  searchEndpoint: string;
  deleteEndpoint: string;
  isDeletable: (item: T) => boolean;
  // Extra fields merged into the delete body — `fileId` for movies,
  // `fileIds[]` for series, etc.
  deleteBodyExtras: (item: T) => Record<string, unknown>;
};

function createBulkConfig<T extends FlaggedMedia>(
  mediaType: MediaType,
  spec: Specifics<T>,
): Pick<BulkActionsConfig<T>, "mediaType" | "search" | "ignore" | "delete"> {
  return {
    mediaType,
    search: {
      endpoint: spec.searchEndpoint,
      body: (item, instId) => ({ instanceId: instId, mediaId: item.id, title: item.title }),
    },
    ignore: {
      endpoint: "/ignore",
      body: (item, instId) => ({
        instanceId: instId,
        mediaId: item.id,
        mediaType,
        title: item.title,
      }),
    },
    delete: {
      endpoint: spec.deleteEndpoint,
      isDeletable: spec.isDeletable,
      body: (item, instId, search) => ({
        instanceId: instId,
        mediaId: item.id,
        title: item.title,
        search,
        ...spec.deleteBodyExtras(item),
      }),
    },
  };
}

export const MOVIE_BULK_CONFIG = createBulkConfig<FlaggedMovie>("movie", {
  searchEndpoint: "/radarr/movies/search",
  deleteEndpoint: "/radarr/movies/delete",
  isDeletable: (m) => m.hasFile && m.movieFileId > 0,
  deleteBodyExtras: (m) => ({ fileId: m.movieFileId }),
});

export const SERIES_BULK_CONFIG = createBulkConfig<FlaggedSeries>("series", {
  searchEndpoint: "/sonarr/series/search",
  deleteEndpoint: "/sonarr/series/delete",
  isDeletable: (s) => s.episodeFiles.length > 0,
  deleteBodyExtras: (s) => ({ fileIds: s.episodeFiles.map((f) => f.id) }),
});
