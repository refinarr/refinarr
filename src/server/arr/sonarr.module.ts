import { z } from "zod";
import { SonarrClient } from "@/server/clients/SonarrClient";
import { SeriesService } from "@/server/services/SeriesService";
import { ARR_META } from "@/shared/arr-meta";
import { defineArrModule } from "./definition";

// Payload shapes for Sonarr-specific queue actions. Each handler parses
// its own payload, so search-worker doesn't need to know the schema
// vocabulary of every arr. The same schemas double as `dispatchExtras`
// below — the dispatcher's input shape is derived from them via z.infer.
const noExtras = z.object({});
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
  // Sonarr's queue actions need per-action disambiguators so two
  // different-season (or different-episode-file) enqueues for the
  // same series don't collide on the partial unique index:
  //   series  → no extra disambiguator (one row per series)
  //   season  → seasonNumber (one row per (series, season))
  //   episode → fileId        (one row per (series, fileId))
  // Payload shape mirrors the queueHandlers above; the same
  // information that lets the worker dispatch correctly is what
  // makes the dedup row identity unique.
  dedupKey: (action, payload) => {
    if (action === "season") {
      const { seasonNumber } = seasonPayload.parse(payload);
      return `:${seasonNumber}`;
    }
    if (action === "episode") {
      const { fileId } = episodePayload.parse(payload);
      return `:file:${fileId}`;
    }
    return "";
  },
  // Per-action dispatch-input extras. composition.ts derives
  // `SearchDispatchInput` from these — adding a new Sonarr action
  // (or a new arr) needs no edit in SearchDispatcher.ts.
  dispatchExtras: {
    series: noExtras,
    season: seasonPayload,
    episode: episodePayload,
  },
});
