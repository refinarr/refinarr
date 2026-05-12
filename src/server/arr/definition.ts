import type { ArrClient } from "@/server/clients/ArrClient";
import type { MediaServiceFacade } from "@/server/services/media-service-facade";
import type { ArrMeta } from "@/shared/arr-meta";
import type {
  ActionLog,
  ArrType,
  Instance,
  SearchQueueAction,
  SearchQueueEntry,
} from "@/shared/types/models";

// Dependencies the composition root injects into each per-arr service.
// Today only `createClient` (the universal factory that dispatches by
// instance.type); future deps (e.g. a fake clock, a metrics emitter)
// extend this shape without touching every service file.
export interface MediaServiceDeps {
  createClient: (instance: Instance) => ArrClient;
}

// Context passed to every queue handler. `service` is typed against the
// module's concrete service via the generic on ArrDefinition, so handlers
// can call subclass-specific methods (e.g. `triggerSeasonSearch` on
// SeriesService) without casts.
export interface QueueHandlerContext<TService extends MediaServiceFacade> {
  service: TService;
  instance: Instance;
  entry: SearchQueueEntry;
  payload: unknown;
}

// One handler per `SearchQueueAction`. Each per-arr module owns its
// payload parsing (e.g. the season-number zod schema lives inside
// sonarr.module.ts, not search-worker).
export type QueueHandler<TService extends MediaServiceFacade> = (
  ctx: QueueHandlerContext<TService>,
) => Promise<ActionLog>;

// The contract every per-arr module fulfills. Generic over `TType`,
// `TClient`, `TService`, and `TActions` (the queue-action vocabulary
// declared in `meta.queueActions`). The composition root indexes a
// `Record<ArrType, …>` of these (the `satisfies` enforces exhaustiveness)
// and exposes typed singletons + a queue dispatcher.
export interface ArrDefinition<
  TType extends ArrType,
  TClient extends ArrClient,
  TService extends MediaServiceFacade,
  TActions extends readonly SearchQueueAction[],
> {
  meta: ArrMeta<TType, TActions>;
  Client: new (instance: Instance) => TClient;
  createService: (deps: MediaServiceDeps) => TService;
  // One handler per advertised action. Required (not Partial): if
  // `meta.queueActions` lists "season" then `queueHandlers.season` must
  // exist, which closes the "module advertises but doesn't implement"
  // gap at compile time. `dispatchQueueEntry` still has a runtime throw
  // for unknown actions because `entry.action` comes from the DB
  // (untrusted string), but the static side is exhaustive.
  queueHandlers: {
    [K in TActions[number]]: QueueHandler<TService>;
  };
}

// Identity helper that preserves the literal types of every field the
// per-arr module declares. The `const TType` and `const TActions`
// generics keep `meta.type` and `meta.queueActions` as their literal
// tuples — without them the inference widens and the per-action
// handler-coverage check above is meaningless.
export function defineArrModule<
  const TType extends ArrType,
  TClient extends ArrClient,
  TService extends MediaServiceFacade,
  const TActions extends readonly SearchQueueAction[],
>(
  def: ArrDefinition<TType, TClient, TService, TActions>,
): ArrDefinition<TType, TClient, TService, TActions> {
  return def;
}
