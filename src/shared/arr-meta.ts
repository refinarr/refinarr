import type { ArrType, SearchQueueAction } from "./types/models";

// Per-arr metadata. Data-only — no runtime references to client / service
// classes — so this file is safe to import from any layer (server, client,
// shared). The single source of truth for `label`, `libraryRoute`,
// `apiNamespace`, `itemNoun`, and the queue-action vocabulary each arr
// supports.
//
// Adding Lidarr / Whisparr means adding a row here AND a new per-arr
// module file under `src/server/arr/`. Consumers (sidebar nav, dashboard
// card, command palette, auto-runner, etc.) automatically pick up the
// new entry by iterating `ALL_ARR_TYPES` or indexing `ARR_META[type]`.
export interface ArrMeta<
  TType extends ArrType = ArrType,
  TActions extends readonly SearchQueueAction[] = readonly SearchQueueAction[],
> {
  type: TType;
  // Display name ("Radarr") used in the dashboard fleet panel, command
  // palette, instance card type-badge tooltip.
  label: string;
  // Canonical list-page route ("/movies"). Multiple UI surfaces link to it.
  libraryRoute: string;
  // API namespace under /api ("/api/radarr"). Used by client hooks that
  // build URLs from the instance type.
  apiNamespace: string;
  // Item noun for status text + i18n fallbacks ("movie" / "movies").
  itemNoun: { singular: string; plural: string };
  // Queue action vocabulary this arr supports. Radarr only enqueues
  // "movie"; Sonarr fans out to "series" / "season" / "episode". The
  // tuple's literal type drives the per-arr handler requirement in
  // `ArrDefinition.queueHandlers` and the constraint on
  // `defaultBatchAction` below.
  queueActions: TActions;
  // The action stamped on a per-item batch enqueue by the auto-runner.
  // Constrained to a member of `queueActions` so an arr can't advertise
  // a batch action it doesn't actually handle.
  defaultBatchAction: TActions[number];
  // i18n key under `dashboard.instanceCard.*` for the "N flagged X" noun.
  // Pluralisation rules vary by locale, so we name a key instead of
  // building the string from `itemNoun` directly.
  dashboardCardNounI18nKey: string;
}

// Input shape for `defineArrMeta`. Wraps `ArrMeta` to add a `NoInfer`
// barrier on `defaultBatchAction` so the field can't be used to infer
// `TActions`. Without the barrier, TS may widen `TActions` to satisfy
// the constraint silently (e.g. accept `queueActions: ["movie"]` with
// `defaultBatchAction: "series"`) — the bad row only errors downstream
// at the consuming `ArrDefinition`, not at the meta declaration.
type ArrMetaInput<
  TType extends ArrType,
  TActions extends readonly SearchQueueAction[],
> = Omit<ArrMeta<TType, TActions>, "defaultBatchAction"> & {
  defaultBatchAction: NoInfer<TActions[number]>;
};

// Identity helper that fires the `defaultBatchAction ∈ queueActions`
// check at the meta declaration AND preserves narrow literal types on
// every field for downstream consumers.
//
// Generic structure:
//   - TType / TActions narrow `type` and `queueActions` from the input.
//     `NoInfer` on `defaultBatchAction` (inside `ArrMetaInput`) blocks
//     it from influencing TActions inference — so TActions is purely
//     `queueActions` and the membership check is exact.
//   - TMeta captures the whole input shape so the return type keeps
//     literals on other fields (e.g. dashboardCardNounI18nKey =
//     "flaggedMoviesNoun" instead of widening to `string`). The
//     `meta: TMeta & ArrMetaInput<...>` intersection makes the
//     NoInfer constraint apply at the parameter position too.
export function defineArrMeta<
  const TType extends ArrType,
  const TActions extends readonly SearchQueueAction[],
  const TMeta extends ArrMetaInput<TType, TActions>,
>(meta: TMeta & ArrMetaInput<TType, TActions>): TMeta {
  return meta;
}

// `as const satisfies` preserves literal types per row (so consumers see
// `ARR_META.radarr.type` as `"radarr"`, not `ArrType`) while enforcing
// exhaustive coverage of `ArrType`. Adding a member to `ArrType` errors
// this declaration until a row is added.
export const ARR_META = {
  radarr: defineArrMeta({
    type: "radarr",
    label: "Radarr",
    libraryRoute: "/movies",
    apiNamespace: "/api/radarr",
    itemNoun: { singular: "movie", plural: "movies" },
    queueActions: ["movie"],
    defaultBatchAction: "movie",
    dashboardCardNounI18nKey: "flaggedMoviesNoun",
  }),
  sonarr: defineArrMeta({
    type: "sonarr",
    label: "Sonarr",
    libraryRoute: "/shows",
    apiNamespace: "/api/sonarr",
    itemNoun: { singular: "series", plural: "series" },
    queueActions: ["series", "season", "episode"],
    defaultBatchAction: "series",
    dashboardCardNounI18nKey: "flaggedSeriesNoun",
  }),
} as const satisfies { [K in ArrType]: ArrMeta<K> };

// Default arr type used when a new-instance form starts blank. Radarr
// happens to be alphabetically first; the choice is cosmetic and the
// user changes it before saving.
export const DEFAULT_ARR_TYPE: ArrType = "radarr";

// Stable iteration order over every supported arr type. Derived from
// ARR_META so adding Lidarr / Whisparr there is enough — no separate
// list to keep in sync.
export const ALL_ARR_TYPES = Object.keys(ARR_META) as ArrType[];

// Per-type library-page route map, kept as a public export for legacy
// callers that already index by arr-type (sidebar nav, command palette,
// dashboard card). New code can reach for `ARR_META[type].libraryRoute`
// directly.
export const ARR_LIBRARY_ROUTE: Record<ArrType, string> = Object.fromEntries(
  ALL_ARR_TYPES.map((t) => [t, ARR_META[t].libraryRoute]),
) as Record<ArrType, string>;

// Type-guard for narrowing string inputs (Select onValueChange, URL
// params, etc.) to ArrType without an unchecked `as ArrType` cast.
export const isArrType = (v: string): v is ArrType =>
  (ALL_ARR_TYPES as readonly string[]).includes(v);
