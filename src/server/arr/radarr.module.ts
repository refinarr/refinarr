import { RadarrClient } from "@/server/clients/RadarrClient";
import { MovieService } from "@/server/services/MovieService";
import { ARR_META } from "@/shared/arr-meta";
import { defineArrModule } from "./definition";

// Self-contained registration for the Radarr backend. Imported by the
// composition root; nothing else should reach for it directly. To add
// a new built-in arr, copy this file's shape next to it and add the
// new module to `BUILTIN_MODULES` in `composition.ts`.
export const radarrModule = defineArrModule({
  meta: ARR_META.radarr,
  Client: RadarrClient,
  createService: (deps) => new MovieService(deps),
  queueHandlers: {
    movie: ({ service, instance, entry }) =>
      service.triggerSearch(instance.id, entry.mediaId, entry.title, {
        groupId: entry.groupId ?? undefined,
      }),
  },
});
