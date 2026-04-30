import type { Instance } from "@/shared/types/models";
import { RadarrClient } from "./RadarrClient";
import { SonarrClient } from "./SonarrClient";
import type { ArrClient } from "./ArrClient";

export class ArrClientFactory {
  static createArrClient(instance: Instance): ArrClient {
    if (instance.type === "radarr") return new RadarrClient(instance);
    if (instance.type === "sonarr") return new SonarrClient(instance);
    throw new Error(`Unknown instance type: ${instance.type}`);
  }
}
