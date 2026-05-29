import type { z } from "zod";
import type { ArrClient } from "@/server/clients/ArrClient";
import type { MediaServiceFacade } from "@/server/arr/media-service-facade";
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
// `queueHandlers`, `dedupKey`, and `dispatchExtras` all key by
// `TActions[number]` (or take it contravariantly), so a wide
// `Record<ArrType, ArrDefinition<…, readonly SearchQueueAction[]>>`
// can't hold mixed concrete-action modules. Each per-arr module
// type-checks those fields inside `defineArrModule`; the registry
// only needs to prove keys + meta / Client / createService line up.
type RegistryEntry = Omit<
  ArrDefinition<
    ArrType,
    ArrClient,
    MediaServiceFacade,
    readonly SearchQueueAction[],
    Record<SearchQueueAction, z.ZodType>
  >,
  "queueHandlers" | "dedupKey" | "dispatchExtras"
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

// Typed factory — narrows the returned client to the concrete subclass
// when the caller already knows `instance.type` matches `expectedType`.
//
// composition.ts stays HTTP-free: it doesn't know about routes or
// HttpError. Callers that take user-supplied `instanceId` (route
// handlers) MUST validate the arr-type FIRST via `assertArrType()`
// from `@/server/lib/api-errors` so a mismatch surfaces as a
// deterministic 400, not a 500 here. After the assertion, TS narrows
// `instance.type` to `T` and the cast below is sound.
//
// Callers that already hold a type-narrowed instance (post-assertion
// or by service-layer invariant) pay no runtime check overhead — the
// runtime guard below is defense-in-depth for direct internal use.
export function createTypedClient<T extends ArrType>(
  instance: Instance,
  expectedType: T,
): ClientFor<T> {
  if (instance.type !== expectedType) {
    // Internal invariant check — routes must validate via
    // `assertArrType` before reaching here. A mismatch firing here
    // means a service-layer bug, surfaces as 500 via createApiHandler.
    throw new Error(
      `Instance ${instance.id} is type ${instance.type}, expected ${expectedType}`,
    );
  }
  return createArrClient(instance) as ClientFor<T>;
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

// Computes the dedup disambiguator string for a (arrType, action,
// payload) triple. SearchQueueService passes the result as the
// `dedupKey` column value so the partial unique index
// `(instanceId, action, mediaId, dedupKey) WHERE status = 'pending'`
// scopes uniqueness correctly per (arr-type, action).
//
// Keyed by `arrType` rather than `action` alone — even though Radarr
// / Sonarr action vocabularies don't currently overlap, indexing by
// action would silently let a future arr's same-named action
// (Lidarr's hypothetical "episode" for podcasts, Whisparr's "scene"
// vs Sonarr's "season"…) clobber the prior module's dedupKey at
// module load. Indexing by arrType keeps each module's action
// namespace local.
//
// Throws if `action` isn't declared in the module's `meta.queueActions`
// — defense against malformed input or a stale code path that mixes
// arr-types.
export function dedupKeyFor(
  arrType: ArrType,
  action: SearchQueueAction,
  payload: Record<string, unknown>,
): string {
  const def = BUILTIN_MODULES[arrType];
  if (!def) {
    throw new Error(`Unknown arr type: ${arrType as string}`);
  }
  // The `queueActions` tuple is the source of truth for which actions
  // this arr owns. A caller passing an action this arr doesn't handle
  // is a bug; surface it loudly rather than computing a meaningless
  // dedupKey from the wrong module's logic.
  if (
    !(def.meta.queueActions as readonly SearchQueueAction[]).includes(action)
  ) {
    throw new Error(
      `Arr "${arrType}" does not handle queue action "${action}"`,
    );
  }
  // Per-module dedupKey is narrowly typed against its own action set;
  // erase here at the boundary since the runtime check above proves
  // the action is in-set.
  const fn = def.dedupKey as (
    action: SearchQueueAction,
    payload: Record<string, unknown>,
  ) => string;
  return fn(action, payload);
}

// Shared base shape every dispatch input carries.
interface SearchDispatchBase {
  mediaId: number;
  title: string;
  groupId?: string;
}

// Flatten an intersection into a single object type. TS's
// excess-property check sometimes only inspects the first member of
// an intersection at object-literal call sites; flattening forces
// the merged shape so extras like `seasonNumber` are recognized as
// known properties of `SearchDispatchInput`.
type Flatten<T> = { [K in keyof T]: T[K] };

// zod 4 infers `z.object({})` as `Record<string, never>` — that
// index signature poisons intersections (every string key including
// `action` becomes `never`). Strip it so the no-extras case
// contributes an empty bag to the intersection instead.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type CleanExtras<T> = string extends keyof T ? {} : T;

// Discriminated union of every (arr-type, action) variant — derived
// directly from `BUILTIN_MODULES`. Each variant carries:
//   - `instance: Pick<Instance, "id"> & { type: <arr-type> }` so TS
//     rejects e.g. `{ action: "season", instance: { type: "radarr" } }`
//   - `action: <one of the arr's queueActions>`
//   - any arr-specific extras inferred from the module's per-action
//     zod schema in `dispatchExtras`
//   - the shared `SearchDispatchBase` fields
//
// The action union sources from `meta.queueActions[number]`, not
// `keyof dispatchExtras` — `meta.queueActions` is the authoritative
// declaration of what this arr handles. Any stray entries in
// `dispatchExtras` for actions NOT in queueActions are ignored here;
// the per-arr handler-coverage check in `ArrDefinition.queueHandlers`
// already forces declared actions to have schemas.
//
// Adding a new arr (Lidarr/Whisparr) needs zero edits here: the new
// module declares its `meta.queueActions` and `dispatchExtras` schemas;
// this union automatically gains the variants.
// Validates and extracts the arr-specific dispatch extras for a given
// (arrType, action) pair using the owning module's zod schema. Stripping
// unknown keys here means an upstream caller that TS-bypassed extras
// can't sneak them into the queue payload; validating means a malformed
// payload (missing required fields, wrong types) fails fast at dispatch
// rather than at drain.
//
// `raw` is the full dispatch input — the schema strips base fields
// (instance/action/mediaId/title/groupId) along with any unknowns since
// they aren't declared in the per-action schema. The result is exactly
// the per-action shape that needs to live in `SearchQueue.payload`.
export function parseDispatchExtras(
  arrType: ArrType,
  action: SearchQueueAction,
  raw: unknown,
): Record<string, unknown> {
  const def = BUILTIN_MODULES[arrType];
  if (!def) {
    throw new Error(`Unknown arr type: ${arrType as string}`);
  }
  const extras = def.dispatchExtras as Partial<
    Record<SearchQueueAction, z.ZodType>
  >;
  const schema = extras[action];
  if (!schema) {
    throw new Error(
      `Arr "${arrType}" does not handle queue action "${action}"`,
    );
  }
  return schema.parse(raw) as Record<string, unknown>;
}

export type SearchDispatchInput = {
  [K in ArrType]: {
    [A in (typeof BUILTIN_MODULES)[K]["meta"]["queueActions"][number]]: A extends keyof (typeof BUILTIN_MODULES)[K]["dispatchExtras"]
      ? Flatten<
          {
            instance: Pick<Instance, "id"> & { type: K };
            action: A;
          } & CleanExtras<
            z.infer<(typeof BUILTIN_MODULES)[K]["dispatchExtras"][A]>
          > &
            SearchDispatchBase
        >
      : never;
  }[(typeof BUILTIN_MODULES)[K]["meta"]["queueActions"][number]];
}[ArrType];
