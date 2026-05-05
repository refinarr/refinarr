import type { ArrType, Instance } from "@/shared/types/models";
import { RadarrClient } from "./RadarrClient";
import { SonarrClient } from "./SonarrClient";
import type { ArrClient } from "./ArrClient";

// Type-keyed registry of ArrClient constructors. Adding Lidarr / Whisparr
// is a single-line entry here; no callers change. Mirrors the
// mediaServiceFor pattern used for media services.
const constructors: Record<ArrType, new (instance: Instance) => ArrClient> = {
  radarr: RadarrClient,
  sonarr: SonarrClient,
};

export class ArrClientFactory {
  static createArrClient(instance: Instance): ArrClient {
    const Ctor = constructors[instance.type];
    if (!Ctor) throw new Error(`Unknown instance type: ${instance.type}`);
    return new Ctor(instance);
  }
}
