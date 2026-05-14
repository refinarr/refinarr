import type { z } from "zod";
import type { ArrClient } from "@/server/clients/ArrClient";
import type { MediaServiceFacade } from "@/server/arr/media-service-facade";
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
// `TClient`, `TService`, `TActions` (the queue-action vocabulary
// declared in `meta.queueActions`), and `TDispatchExtras` (the
// per-action zod schemas — kept as a generic so each schema's narrow
// shape survives `defineArrModule`'s inference and downstream
// `z.infer` extraction). The composition root indexes a
// `Record<ArrType, …>` of these (the `satisfies` enforces exhaustiveness)
// and exposes typed singletons + a queue dispatcher.
export interface ArrDefinition<
  TType extends ArrType,
  TClient extends ArrClient,
  TService extends MediaServiceFacade,
  TActions extends readonly SearchQueueAction[],
  TDispatchExtras extends {
    [K in TActions[number]]: z.ZodType;
  },
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
  // Computes the per-action disambiguator string written to
  // `SearchQueue.dedupKey`. The partial unique index
  // `(instanceId, action, mediaId, dedupKey) WHERE status = 'pending'`
  // uses this value to scope dedup correctly for arrs whose actions
  // need extra keys (e.g. Sonarr's `season` action keys on
  // `seasonNumber`; without this, two different-season enqueues for
  // the same series would collide on the unique constraint).
  //
  // Return `""` for actions with no extra disambiguator (Radarr's
  // `movie`, Sonarr's `series`). The full dedup tuple is then
  // `(instanceId, action, mediaId, "")` — still unique per media item.
  //
  // `payload` is the same JSON the queueHandler parses at drain time;
  // modules typically reuse the same zod schema or read the fields
  // they expect directly.
  dedupKey: (
    action: TActions[number],
    payload: Record<string, unknown>,
  ) => string;
  // Per-action zod schemas for the arr-specific dispatch-input extras
  // (e.g. Sonarr's `season` adds `{ seasonNumber: number }`). Drives
  // two things at the TYPE level:
  //   - composition.ts derives `SearchDispatchInput` via z.infer +
  //     mapped type over BUILTIN_MODULES, so SearchDispatcher.ts
  //     never needs per-arr edits.
  //   - the queue payload is the same shape, so the dispatcher just
  //     spreads the extras into payload without per-action branches.
  // Use `z.object({})` for actions with no extras (Radarr `movie`,
  // Sonarr `series`). Modules typically reuse the same zod schema
  // their `queueHandlers` use to parse the drain-time payload.
  // `TDispatchExtras` is passed through so each schema's narrow type
  // survives `defineArrModule`'s inference — `z.infer` downstream in
  // `composition.ts` reads the per-action shape (e.g. Sonarr's
  // `season` resolves to `{ seasonNumber: number }`). Constraining
  // values to `z.ZodType` on the field directly would collapse
  // every schema to `any`.
  dispatchExtras: TDispatchExtras;
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
  // `const` so the inferred type pins each per-action schema literally —
  // composition.ts's `z.infer<...>` reads those narrow shapes to build
  // `SearchDispatchInput`. Without `const`, the inferred type widens
  // to `{ [K]: z.ZodType }` and z.infer collapses to `unknown`.
  const TDispatchExtras extends {
    [K in TActions[number]]: z.ZodType;
  },
>(
  def: ArrDefinition<TType, TClient, TService, TActions, TDispatchExtras>,
): ArrDefinition<TType, TClient, TService, TActions, TDispatchExtras> {
  return def;
}
