import type { ArrType, Instance } from "@/shared/types/models";
import { RadarrClient } from "./RadarrClient";
import { SonarrClient } from "./SonarrClient";
import type { ArrClient } from "./ArrClient";

// Type-keyed registry of ArrClient constructors. Adding Lidarr / Whisparr
// is a single-line entry here; no callers change. Mirrors the
// mediaServiceFor pattern used for media services.
//
// `satisfies` (instead of `:`) preserves the literal type of each value
// so consumers can derive things like `ClientFor<"sonarr">` directly
// from this registry — no second arr-type → class mapping to keep in
// sync.
const constructors = {
  radarr: RadarrClient,
  sonarr: SonarrClient,
} satisfies Record<ArrType, new (instance: Instance) => ArrClient>;

// Public type for consumers (e.g. `MediaService.withClient`'s overload)
// that need to narrow the concrete client class from an arr-type
// discriminator. Single source of truth — drives both the runtime
// factory and the compile-time return-type narrowing.
export type ClientFor<T extends ArrType> = InstanceType<
  (typeof constructors)[T]
>;

export class ArrClientFactory {
  static createArrClient(instance: Instance): ArrClient {
    const Ctor = constructors[instance.type];
    if (!Ctor) throw new Error(`Unknown instance type: ${instance.type}`);
    return new Ctor(instance);
  }
}
