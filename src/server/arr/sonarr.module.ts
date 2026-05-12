import { z } from "zod";
import { SonarrClient } from "@/server/clients/SonarrClient";
import { SeriesService } from "@/server/services/SeriesService";
import { ARR_META } from "@/shared/arr-meta";
import { defineArrModule } from "./definition";

// Payload shapes for Sonarr-specific queue actions. Each handler parses
// its own payload, so search-worker doesn't need to know the schema
// vocabulary of every arr.
const seasonPayload = z.object({
  seasonNumber: z.number().int().nonnegative(),
});
const episodePayload = z.object({ fileId: z.number().int().positive() });

// Self-contained registration for the Sonarr backend. See radarr.module.ts
// for the pattern.
export const sonarrModule = defineArrModule({
  meta: ARR_META.sonarr,
  Client: SonarrClient,
  createService: (deps) => new SeriesService(deps),
  queueHandlers: {
    series: ({ service, instance, entry }) =>
      service.triggerSearch(instance.id, entry.mediaId, entry.title, {
        groupId: entry.groupId ?? undefined,
      }),
    season: ({ service, instance, entry, payload }) => {
      const { seasonNumber } = seasonPayload.parse(payload);
      return service.triggerSeasonSearch(
        instance.id,
        entry.mediaId,
        seasonNumber,
        entry.title,
        { groupId: entry.groupId ?? undefined },
      );
    },
    episode: ({ service, instance, entry, payload }) => {
      const { fileId } = episodePayload.parse(payload);
      return service.triggerEpisodeFileSearch(
        instance.id,
        entry.mediaId,
        fileId,
        entry.title,
        { groupId: entry.groupId ?? undefined },
      );
    },
  },
});
