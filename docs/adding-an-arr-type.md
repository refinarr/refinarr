# Adding a new `*arr` type

refinarr is built as a **module map**. Each supported product (Radarr, Sonarr,
and future ones like Lidarr / Whisparr) is described by a couple of data rows
plus one self-contained module file. A composition root wires everything
together, and most of the UI discovers a new type automatically.

This guide walks through every edit needed to add a new type, using the
existing Radarr (single-action) and Sonarr (multi-action) implementations as
templates. Want to claim one? See the tracking issues for
[Lidarr](https://github.com/refinarr/refinarr/labels/help%20wanted) and
[Whisparr](https://github.com/refinarr/refinarr/labels/help%20wanted).

## What you get for free vs. what you write

Once you add the `ArrType` member, the two data rows (`ARR_META`, `ARR_UI`),
and the module, these surfaces pick up the new type with **no further edits** —
they all iterate the registries:

- Sidebar nav (`NavContent`) and command palette (`CommandPalette`)
- Dashboard KPI + fleet cards, mobile tab bar, the new-instance type selector
- Queue dispatch (`dispatchQueueEntry`), and the `createArrClient` /
  `mediaServiceFor` factories

What you **must hand-write** (the real work):

- A `*Client` subclass, a `*Service` subclass, and a `*.module.ts`
- Per-type **API routes** under `src/app/api/<namespace>/…`
- A full per-type **UI set** — `page.tsx` is not a one-liner; it composes
  `MediaListShell` with hand-written columns, a card, a drawer, a query hook,
  and a bulk config
- i18n keys, MSW test handlers, and tests

> **Tip:** make the type-union change (step 1) first, then run
> `yarn tsc --noEmit`. The compile errors that appear are your to-do list —
> `ARR_META`, `ARR_UI`, and the composition registry all fail to type-check
> until their rows exist.

---

## Steps

The examples below add a hypothetical **Lidarr** (music) type. Substitute your
product's nouns/actions.

### 1. Extend the type unions — `src/shared/types/models.ts`

```ts
export type ArrType = "radarr" | "sonarr" | "lidarr";
```

Only extend `SearchQueueAction` if your product needs new action verbs beyond
the existing `"movie" | "series" | "season" | "episode"`:

```ts
export type SearchQueueAction = "movie" | "series" | "season" | "episode" | "album";
```

This single change is what triggers the guiding compile errors for the rest.

### 2. Add the metadata row — `src/shared/arr-meta.ts`

Data-only; safe to import from any layer. Add a row via `defineArrMeta`
(it enforces `defaultBatchAction ∈ queueActions` at declaration):

```ts
lidarr: defineArrMeta({
  type: "lidarr",
  label: "Lidarr",
  libraryRoute: "/albums",
  apiNamespace: "/api/lidarr",
  itemNoun: { singular: "album", plural: "albums" },
  queueActions: ["album"],
  defaultBatchAction: "album",
  dashboardCardNounI18nKey: "flaggedAlbumsNoun",
}),
```

`ALL_ARR_TYPES` and `ARR_LIBRARY_ROUTE` derive from this map automatically.

### 3. Add the client-UI row — `src/client/lib/arr-ui.ts`

Lives next to React because the icon is a component ref. Pick a
[lucide](https://lucide.dev) icon:

```ts
import { Disc3 } from "lucide-react";

lidarr: {
  navLabelKey: "albums",
  commandPaletteHeadingKey: "groups.lidarrInstance",
  Icon: Disc3,
},
```

### 4. Write the client — `src/server/clients/LidarrClient.ts` (new)

Extend `ArrClient`. The base class gives you `fetch()` (with the 10s timeout),
the SSRF URL guard, the outbound rate-limiter, and response-body redaction —
don't reimplement those. Implement the abstract members:

- `expectedAppName` — the `appName` the product's `/api/v3/system/status`
  reports (e.g. `"Lidarr"`); the connection test rejects a URL pointing at the
  wrong product.
- `projectHistoryRecord(record)` — map the product's id field (`albumId`, …)
  into the uniform `{ mediaId, scope }` the status poller correlates against.
- `getQualityProfiles()`, `triggerSearch()`, `deleteFile()`, plus the
  media-fetch methods (`getAlbums()` / `getArtists()` / …).

Use `RadarrClient.ts` / `SonarrClient.ts` as the template.

### 5. Write the service — `src/server/services/AlbumService.ts` (new)

Extend `MediaService<TItem>` and satisfy `MediaServiceFacade`. Implement the
two abstract members:

- `cacheNamespace` (e.g. `"albums"`) — keys the in-memory data cache.
- `getForWarm(instanceId, query)` — the cache-warm fetch.

Plus your query + action methods. **All mutations must go through
`MediaService.executeAction()`** — that's what guarantees the dry-run check and
the `ActionLog` write. Don't call the client's delete/search from a route
directly.

### 6. Write the module — `src/server/arr/lidarr.module.ts` (new)

Tie the client + service + queue handlers together with `defineArrModule`.
Single-action template (Radarr):

```ts
import { z } from "zod";
import { LidarrClient } from "@/server/clients/LidarrClient";
import { AlbumService } from "@/server/services/AlbumService";
import { ARR_META } from "@/shared/arr-meta";
import { defineArrModule } from "./definition";

const noExtras = z.object({});

export const lidarrModule = defineArrModule({
  meta: ARR_META.lidarr,
  Client: LidarrClient,
  createService: (deps) => new AlbumService(deps),
  queueHandlers: {
    album: ({ service, instance, entry }) =>
      service.triggerSearch(instance.id, entry.mediaId, entry.title, {
        groupId: entry.groupId ?? undefined,
      }),
  },
  dedupKey: () => "",
  dispatchExtras: { album: noExtras },
});
```

If your product fans out to sub-items (like Sonarr's season/episode), see
`sonarr.module.ts` for the multi-action pattern: each action gets a zod
payload schema, a `queueHandlers` entry, a `dedupKey` branch, and a
`dispatchExtras` entry. `queueHandlers` is **required per action** — listing an
action in `queueActions` without a handler is a compile error.

### 7. Register it — `src/server/arr/composition.ts`

Four edits, all near the top:

```ts
import { lidarrModule } from "./lidarr.module";

const BUILTIN_MODULES = defineBuiltinModules({
  radarr: radarrModule,
  sonarr: sonarrModule,
  lidarr: lidarrModule, // ← key must equal module.meta.type (enforced)
});

export const albumService = lidarrModule.createService(sharedDeps);

const SERVICES = {
  radarr: movieService,
  sonarr: seriesService,
  lidarr: albumService, // ←
} satisfies ServicesForModules;
```

Everything else in this file (`createArrClient`, `mediaServiceFor`,
`dispatchQueueEntry`, `SearchDispatchInput`) auto-derives — no edits.

### 8. API routes — `src/app/api/lidarr/…` (new)

Mirror `src/app/api/radarr/*`. The library route uses the shared helpers:

```ts
export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const instanceId = positiveInt(s.get("instanceId") ?? undefined, "instanceId");
  const page = positiveInt(s.get("page") ?? "1", "page");
  const limit = positiveInt(s.get("limit") ?? "50", "limit", 500);
  const query = parseMediaQuery(s);

  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "lidarr");

  const { items, total } = await albumService.getAlbums(instanceId, { page, limit, ...query });
  return NextResponse.json({ items, total, page, limit, hasMore: page * limit < total });
});
```

Add the `search`, `delete`, and `qualityprofiles` routes too. **Rules:** every
mutation route parses a zod schema (`parseJson` / a schema in
`src/shared/types/schemas.ts`); throw the `HttpError` helpers (`badRequest`,
`notFound`, …) — never `NextResponse.json({ error }, { status })`.

### 9. UI — `src/app/albums/…` (new)

Copy the shape of `src/app/movies/` (or `src/app/shows/`). You need:

- `src/app/albums/page.tsx` — composes `MediaListShell` with your column
  definitions, card, and drawer (see `src/app/movies/page.tsx`).
- `src/app/albums/components/albumColumns.tsx`, `AlbumCard.tsx`,
  `AlbumDrawer.tsx`.
- A query hook under `src/client/hooks/media/` (mirror `useMovies`).
- A bulk config in `src/client/components/media/media-bulk-configs`.

### 10. i18n — `messages/en.json`

Add the keys your new rows reference:

- `nav.albums` — sidebar label (matches `ARR_UI.lidarr.navLabelKey`)
- `dashboard.kpi.flaggedAlbums` and `dashboard.instanceCard.flaggedAlbumsNoun`
  (matches `dashboardCardNounI18nKey`; use ICU plural form)
- `commandPalette.groups.lidarrInstance`
- An `albums` namespace (title, `flaggedSummary`, `refreshTitle`, `columns`, …)
  modelled on the existing `movies` / `shows` namespaces

All user-facing strings go through `useTranslations()` — never hardcode.

### 11. Tests

- Add a `lidarrHandlers(...)` MSW factory in `src/test/msw.ts`, mirroring
  `radarrHandlers` / `sonarrHandlers`.
- Unit-test the client + service; add API integration tests
  (`*.integration.test.ts`) that drive the route → service → repo → MSW chain.
- Coverage must stay **≥ 85%** (lines/branches/functions/statements).

---

## Checklist

Copy this into your PR description:

- [ ] 1. `ArrType` (and `SearchQueueAction` if needed) — `src/shared/types/models.ts`
- [ ] 2. `ARR_META` row — `src/shared/arr-meta.ts`
- [ ] 3. `ARR_UI` row + icon — `src/client/lib/arr-ui.ts`
- [ ] 4. `*Client` subclass — `src/server/clients/`
- [ ] 5. `*Service` subclass — `src/server/services/`
- [ ] 6. `*.module.ts` — `src/server/arr/`
- [ ] 7. Register in `BUILTIN_MODULES` + `SERVICES` + service singleton — `src/server/arr/composition.ts`
- [ ] 8. API routes (library, search, delete, qualityprofiles) — `src/app/api/<ns>/`
- [ ] 9. UI set (page, columns, card, drawer, hook, bulk config) — `src/app/<route>/`
- [ ] 10. i18n keys — `messages/en.json`
- [ ] 11. MSW handlers + tests, coverage ≥ 85%
- [ ] `yarn lint && yarn tsc --noEmit && yarn test:coverage && yarn test:e2e` all green

## Gotchas

- **Upstream API specifics differ per product.** Confirm the product's
  `/system/status` `appName`, its history `eventType` integer codes (Servarr
  shares these, but verify), and the id field names your `projectHistoryRecord`
  reads.
- **`dedupKey` matters for multi-action types.** Without a per-action
  disambiguator, two different-sub-item enqueues for the same parent collide on
  the partial-unique queue index. Single-action types return `""`.
- **Don't edit the auto-wired surfaces.** If you find yourself adding a
  `switch (instance.type)`, stop — go through `createArrClient` /
  `mediaServiceFor` / `dispatchQueueEntry` instead.
