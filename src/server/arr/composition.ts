import type { ArrClient } from "@/server/clients/ArrClient";
import type { MediaServiceFacade } from "@/server/services/media-service-facade";
import type {
  ActionLog,
  ArrType,
  Instance,
  SearchQueueAction,
  SearchQueueEntry,
} from "@/shared/types/models";
import type {
  ArrDefinition,
  MediaServiceDeps,
  QueueHandler,
} from "./definition";
import { radarrModule } from "./radarr.module";
import { sonarrModule } from "./sonarr.module";

// Variance-erased entry shape used as the satisfies constraint below.
// QueueHandler is contravariant in TService and the per-action handler
// map is invariant in TActions, so the registry can't carry the strict
// `ArrDefinition` directly — each per-arr module already type-checks
// its own handlers inside `defineArrModule`. The registry only needs to
// prove keys are exhaustive and meta / Client / createService line up.
type RegistryEntry = Omit<
  ArrDefinition<
    ArrType,
    ArrClient,
    MediaServiceFacade,
    readonly SearchQueueAction[]
  >,
  "queueHandlers"
>;

// Identity helper that enforces, at compile time, that every registry
// key equals its module's `meta.type`. The intersection on the
// parameter (`T & { [K in ArrType]: { meta: { type: K } } }`) checks
// each property independently — a swap (`radarr: sonarrModule`) fails
// because sonarrModule's `meta.type === "sonarr"` doesn't satisfy the
// per-key constraint `{ meta: { type: "radarr" } }`. The mapped-type
// trick lives in the argument position rather than as a separate
// assertion so TS evaluates it per-row instead of widening through
// indexed-lookup, which is what tripped up the earlier
// `AssertTrue<...>` attempts.
function defineBuiltinModules<const T extends Record<ArrType, RegistryEntry>>(
  modules: T & { [K in ArrType]: { meta: { type: K } } },
): T {
  return modules;
}

// The single composition point for every built-in arr. Adding Lidarr /
// Whisparr (built-in) is one row here plus the new per-arr module file.
const BUILTIN_MODULES = defineBuiltinModules({
  radarr: radarrModule,
  sonarr: sonarrModule,
});

// Universal factory — dispatches by `instance.type` to the per-arr
// Client constructor.
export function createArrClient(instance: Instance): ArrClient {
  const def = BUILTIN_MODULES[instance.type];
  if (!def) {
    throw new Error(`Unknown instance type: ${instance.type as string}`);
  }
  return new def.Client(instance);
}

// Shared deps handed to every service. Today only the universal
// createClient; future deps (clock, metrics, feature flags) extend
// here without touching service constructors.
const sharedDeps: MediaServiceDeps = { createClient: createArrClient };

// Direct singleton construction. Because each module's `createService`
// is typed against its concrete subclass (via the generic on
// `ArrDefinition`), these exports are `MovieService` / `SeriesService`
// — not `MediaServiceFacade` — without any cast. Route handlers and
// the search-worker dispatcher call subclass-specific methods directly.
export const movieService = radarrModule.createService(sharedDeps);
export const seriesService = sonarrModule.createService(sharedDeps);

// Expected per-key service type, derived from each module's
// `createService` return type. Tighter than `Record<ArrType,
// MediaServiceFacade>` — that loose form would accept
// `radarr: seriesService` silently, which would later miscall through
// `dispatchQueueEntry` because the loose handler cast there assumes
// the (handler, service) pair matches by arr-type.
type ServicesForModules = {
  [K in keyof typeof BUILTIN_MODULES]: ReturnType<
    (typeof BUILTIN_MODULES)[K]["createService"]
  >;
};

// Exhaustive arr-type → service map for callers that branch on
// `instance.type` at runtime (dashboard summary, retry route, status
// poller). The mapped constraint above ties each key's service to its
// module's `createService` return so a swap fails at compile time.
const SERVICES = {
  radarr: movieService,
  sonarr: seriesService,
} satisfies ServicesForModules;

export function mediaServiceFor(arrType: ArrType): MediaServiceFacade {
  return SERVICES[arrType];
}

// Pure dispatcher for SearchQueue rows. Looks up the owning module by
// `instance.type`, finds the handler for `entry.action`, and invokes it
// with the matching service singleton. Throws if the arr-type can't
// handle the action — search-worker catches and marks the row failed.
//
// This is the only seam search-worker uses to invoke per-arr work;
// adding Lidarr / Whisparr (with new SearchQueueAction members) only
// requires extending the module's `queueHandlers`. The worker stays
// arr-agnostic.
export async function dispatchQueueEntry(
  instance: Instance,
  entry: SearchQueueEntry,
  payload: unknown,
): Promise<ActionLog> {
  const def = BUILTIN_MODULES[instance.type];
  // queueHandlers is strictly typed per module (Radarr: { movie },
  // Sonarr: { series, season, episode }) — the union of those rows has
  // no common indexer. Widen to the loose Partial<Record> shape just
  // for the lookup; the runtime invariant (entry.action ∈ this arr's
  // queueActions) is enforced by the missing-handler throw below.
  const handlers = def.queueHandlers as Partial<
    Record<SearchQueueAction, QueueHandler<MediaServiceFacade>>
  >;
  const handler = handlers[entry.action];
  if (!handler) {
    throw new Error(
      `Unsupported queue action "${entry.action}" for ${instance.type}`,
    );
  }
  const service = SERVICES[instance.type];
  return handler({ service, instance, entry, payload });
}

// Public type for consumers that need to narrow the concrete client
// class from an arr-type discriminator. Drives `MediaService.withClient`'s
// typed overload so subclass services (`SeriesService.withClient(id,
// "sonarr")`) get a `SonarrClient` back without an `as` cast.
export type ClientFor<T extends ArrType> = InstanceType<
  (typeof BUILTIN_MODULES)[T]["Client"]
>;
