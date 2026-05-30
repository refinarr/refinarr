# AGENTS.md — refinarr

Operational rules for AI coding agents (Claude Code, Cursor, Aider, Codex, GitHub Copilot, etc.) helping with this repository. **Read this before making any change.**

> ⚠️ **This is NOT the Next.js you know.** This project runs Next.js 16 (App Router). Breaking changes since v14/v15 affect APIs, conventions, and file structure. If your training data is older, **read `node_modules/next/dist/docs/`** for the version in use before writing code. Heed deprecation notices.

---

## Architecture Quick Reference

```text
src/server/    backend only — never imported by client code
src/client/    frontend only — never imported by server code
src/shared/    types/DTOs only — no runtime deps, safe everywhere
src/app/       Next.js pages + thin API route controllers
```

| Pattern | Where | Why |
| --- | --- | --- |
| `createArrClient(instance)` / `mediaServiceFor(type)` from `@/server/arr/composition` | All Radarr/Sonarr access | Never branch on `instance.type`; per-arr modules live in `src/server/arr/<type>.module.ts` |
| `BaseRepository<T>` extension | All DB access | Inherits CRUD; subclass adds specific queries |
| `MediaService.executeAction()` | All media mutations | Dry-run + ActionLog guaranteed in one place |
| `createApiHandler()` wrapper | All API routes | ZodError/UnsafeUrlError → 400, error log, no per-route auth (the proxy does it) |
| `src/proxy.ts` | All requests | Deny-by-default auth gate. Handlers do not re-check. |
| `instanceRepository` only | Reads/writes of `Instance.apiKey` | Encrypts/decrypts AES-256-GCM transparently |
| `useTranslations()` + `messages/en.json` | Every user-visible string | No hardcoded UI text |
| TanStack Query hooks | All client data fetching | No raw `fetch()` in components |
| Focused hooks composed in `page.tsx` | All pages | One slice of state per hook (`useInstanceSelection`, `useMediaFilters`, …); pages are composition roots — no `useFooPage` orchestrator |
| `<MediaListShell>` compound component | `/movies`, `/shows` | Pages collapse to per-domain config (columns, card, drawer); the shell owns the layout + hook composition |
| `HttpError` (server) / `ApiClientError` (client) | All error paths | One class per tier — never per-route `NextResponse.json({ error })`, never per-domain `*Error extends Error` on the client |
| `useConfirm()` (shadcn AlertDialog) | All destructive confirms | Never browser-native `confirm()` |

---

## Project Structure & Module Organization

### Backend (`src/server/`)

- `clients/` — `ArrClient` abstract → `RadarrClient`, `SonarrClient`
- `arr/` — per-arr module map: `definition.ts` (`ArrDefinition` + `defineArrModule`), `radarr.module.ts`, `sonarr.module.ts`, and the `composition.ts` root that exports `createArrClient` / `mediaServiceFor` / `dispatchQueueEntry` / typed `movieService` + `seriesService` singletons
- `repositories/` — `BaseRepository<T>` abstract → per-model repos (`InstanceRepository` encrypts `apiKey` transparently)
- `services/` — `MediaService` abstract → `MovieService`, `SeriesService`; plus `InstanceService`, `DryRunService`
- `lib/` — `db.ts`, `logger.ts` (pino), `app-logger.ts` (DB-persisted, redacted), `handler.ts` (`createApiHandler` — traceId + HttpError dispatch), `api-errors.ts` (`HttpError` + `badRequest` / `unauthorized` / `parseJson` / `positiveInt` …), `auth.ts` (scrypt + sessions), `crypto.ts` (AES-256-GCM at-rest), `url-guard.ts` (SSRF guard), `redact.ts`, `rate-limit.ts`, `ArrRateLimiter.ts`, `DataCache.ts`, `search-worker.ts`. `scoring.ts` lives in `src/shared/` since the math is domain-shape, not server-only.

`src/proxy.ts` is the deny-by-default auth gate that runs before any route handler. See **Security: hard rules** below.

**Rules:**

- New arr backend → (1) add an `ArrMeta` row to `src/shared/arr-meta.ts`, (2) add an `ARR_UI` row to `src/client/lib/arr-ui.ts` (icon + nav label key + command-palette heading key), (3) add `src/server/arr/<type>.module.ts` (extends `ArrClient`, implements service, declares `queueHandlers` for its `SearchQueueAction`s), (4) register in `BUILTIN_MODULES` in `composition.ts`, then add product-specific API routes / pages. Everything else (auto-runner, dashboard card, sidebar nav, command palette, mobile tab bar) iterates `ARR_META` / `ARR_UI` and picks up the new type automatically. Do **not** edit `search-worker.ts`, the dispatch surface in `composition.ts`, or the auto-runner
- New table → new repository extending `BaseRepository<T>`
- New media mutation → method on `MovieService`/`SeriesService` calling `executeAction()`
- Pure functions only in `lib/scoring.ts`
- Read/write `Instance.apiKey` only through `instanceRepository` — never call `prisma.instance.*` directly for that field, encryption is in the repo wrapper
- Any new user-supplied URL passes through `assertSafeArrUrl` from `lib/url-guard.ts`

### Frontend (`src/client/`)

- `components/<domain>/<ComponentName>/` — folder for organisms (own hook/types/sub-components)
- `components/<domain>/Foo.tsx` — flat file for simple atoms
- `hooks/` — TanStack Query data hooks (`useMovies`, `useSeries`) and focused page hooks (`useInstanceSelection`, `useMediaFilters`, `useMediaSelection<T>`, `useDetailDrawer<T>`, `useMediaData<T>`, `useBulkAbort`, `useBulkMediaActions<T>`, `useBulkHandlers<T>`, `useShowSeasonEpisodeActions`). Pages compose these directly — no `useFooPage` orchestrator.
- `lib/` — `api.ts` (HTTP), `query-keys.ts`, `with-toast.ts`, `csv-export.ts`

**Component folder layout:**

```text
ComponentName/
  index.ts            named re-export only
  ComponentName.tsx   component + JSX
  types.ts            local interfaces (omit if none)
  useComponentName.ts component-scoped hook (omit if none)
```

**Rules:**

- Use a folder only when the component owns a hook, has non-trivial types, or groups sub-components — otherwise stay flat
- No `.module.css` — Tailwind is the only styling system
- No inline component definitions inside `app/*/page.tsx`; extract to `components/<domain>/`
- Pages compose focused hooks directly (`useInstanceSelection`, `useMediaFilters`, `useMediaSelection<T>`, `useDetailDrawer<T>`, `useMediaData<T>`, `useBulkMediaActions<T>`, `useBulkAbort`, `useBulkHandlers<T>`) — no `useFooPage` orchestrator

---

## Build, Test, and Development Commands

```bash
yarn dev            # dev server on :7272
yarn build          # production build (run before opening a PR)
yarn start          # production server on :7272
yarn lint           # ESLint
yarn tsc --noEmit   # type-check (run before every commit)

# Tests
yarn test           # vitest (unit + integration), coverage gates enforced (85% lines/functions/statements, 80% branches; server folders gated at 85% branches)
yarn test:watch     # vitest watch mode
yarn test:coverage  # vitest with v8 coverage report
yarn test:e2e       # playwright E2E suite (port 7373, isolated DB)
yarn test:e2e:ui    # playwright UI mode (filter by both setup + chromium projects)

# Prisma
yarn prisma migrate dev --name <descriptive>   # create + apply migration
yarn prisma migrate deploy                     # apply existing (Docker entry)
yarn prisma generate                           # regenerate client
yarn prisma studio                             # GUI browser
```

Before opening a PR:

1. `yarn tsc --noEmit`
2. `yarn lint`
3. `yarn test` (coverage gates: 85% lines/functions/statements repo-wide; 80% branches repo-wide; 85% branches on `server/{lib,repositories,services}` — see `vitest.config.ts`)
4. `yarn build`
5. Manual smoke-test in browser at `http://localhost:7272` (or `yarn test:e2e` if UI changed)

---

## Testing Layout

```text
src/**/__tests__/*.test.ts(x)               unit (server lib, client lib, components, hooks)
src/server/repositories/__tests__/          DB integration (real SQLite, hermetic per test)
src/server/services/__tests__/              service-layer tests (real DB + vi.stubGlobal fetch)
src/app/api/**/__tests__/*.integration.test.ts
                                            API route handler integration (real DB + MSW for upstream Arr)
e2e/*.spec.ts                               end-to-end UI (playwright on a separate :7373 dev server)
e2e/global-setup.ts                         wipes e2e-test.db, runs migrations, seeds the admin user,
                                            writes e2e/.auth/user.json so specs start authenticated
src/test/global-setup.ts                    wipes vitest-test.db, runs migrations once per run
src/test/setup.ts                           truncates all 8 tables + clears DataCache + resets MSW handlers in beforeEach
src/test/msw.ts                             shared MSW server + radarrHandlers() / sonarrHandlers() helpers
src/test/render.tsx                         renderWithProviders() — wraps in NextIntlClientProvider
```

Vitest config (`vitest.config.ts`) runs with `fileParallelism: false` so DB-backed
tests share one migrated SQLite file (`vitest-test.db`). Component tests opt into
the DOM via `// @vitest-environment happy-dom` at the top of the file; everything
else runs in the default `node` env. `LOG_RETENTION_CAP` and
`ACTION_LOG_RETENTION_CAP` env vars override the 5000-row defaults — the test
setup sets them to 5 so trim-overflow paths are exercisable.

Coverage thresholds in `vitest.config.ts` follow a two-tier policy:

- **Repo-wide aggregate:** 85% lines/functions/statements, **80% branches**.
  Branches sit one tier lower because client UI code routinely contains
  short-circuit fallbacks that aren't behaviorally meaningful but trip the
  branch counter.
- **Server folders (`server/lib`, `server/repositories`, `server/services`):**
  85% branches as well. Backend code that decides what hits the database,
  the upstream API, or the user gets the stricter bar.

The coverage `include` list covers `server/lib`, `server/repositories`,
`server/services`, and `client/lib`. Components are not in the threshold but
should still have unit tests when they own non-trivial logic. Adding code in
covered directories without a test will fail the run.

API integration tests:

- Test files use the suffix `*.integration.test.ts` and live next to the route under `__tests__/`.
- Call exported route handlers directly: `import { POST } from "@/app/api/auth/setup/route"` and pass a `NextRequest`. For dynamic routes pass `{ params: Promise.resolve({ id: "1" }) }` as the second arg.
- For routes that hit Sonarr/Radarr (`/api/instances/[id]/test`, `/api/radarr/movies`, `/api/sonarr/series`, action routes), stage upstream responses with `mswServer.use(...radarrHandlers({ baseUrl }, { ... }))` — MSW intercepts `globalThis.fetch` so `ArrClient`'s real fetch path runs.
- MSW is configured with `onUnhandledRequest: "error"` so any unmocked outbound call fails the test loudly instead of silently calling production.

E2E:

- Single Playwright project (`chromium`) — no setup-project dependency.
- `globalSetup` seeds the admin user directly via Prisma + scrypt (skipping the
  `/setup` UI flow) and writes `storageState`. Specs that need auth use
  `test.use({ storageState: "e2e/.auth/user.json" })` so they avoid hitting the
  login rate limit.
- The fresh-DB redirect and the setup form are NOT covered by E2E. They are covered by `src/app/api/auth/__tests__/setup.integration.test.ts`.

CI:

- `.github/workflows/test.yml` runs on push/PR to main. Two jobs: `unit` (lint + tsc + `yarn test:coverage`) and `e2e` (`yarn test:e2e` with Playwright browsers installed via `yarn playwright install --with-deps chromium`).
- Both jobs cache yarn deps via `actions/setup-node@v4`. Coverage and Playwright reports upload as artifacts (7-day retention).

---

## Linting Strategy

- `yarn lint` runs ESLint with `eslint-plugin-boundaries` enforcing the three-layer import rule
- A failing lint is a hard stop — do not commit code that fails lint
- Markdown files: avoid `MD040` (tag fenced blocks `text`/`bash`/`ts`), `MD060` (table pipe spacing `| col |`), `MD031`/`MD032` (blank lines around fences and lists)
- Never use `// eslint-disable` to silence a rule you do not understand — fix the underlying issue

---

## Node.js & TypeScript Best Practices

### TypeScript

- **Strict mode is non-negotiable** — no `any`, no implicit `any`, no `as` casts unless narrowing a union you've already checked
- **Always declare `interface Props`** for components — never inline prop types
- **Use shared union types** — `ScoringMode`, `ArrType`, `MediaType` from `@/shared/types/models`; never `string` for these
- **No boolean soup** — replace `{ isLoading; isError; isEmpty }` with a discriminated union (`type State = "loading" | "error" | "empty" | "ready"`)
- **Use generics and utility types** — `Partial<T>`, `Pick<T, K>`, `Record<K, V>` over hand-rolled equivalents
- **Prefer `unknown` over `any`** when receiving untrusted data; narrow with type guards
- **Type imports** — use `import type { Foo }` for type-only imports to keep runtime bundles clean

### Node / Runtime

- **ESM only** — no `require()`, no `module.exports`
- **`async/await`** over `.then()` chains
- **`const`** by default; `let` only when reassignment is required; never `var`
- **No top-level side effects** in modules (other than singletons like `prisma`, `logger`)
- **Errors** — throw `Error` instances with messages; never throw strings or numbers
- **Logging** — use `logger` from `src/server/lib/logger.ts`; never `console.log` in committed code

---

## Code Shape

- **Small functions** — if a function does not fit on one screen, split it
- **No comments by default** — only when the WHY is non-obvious (a workaround, a hidden constraint, a subtle invariant)
- **Never explain WHAT** — well-named identifiers do that; the comment becomes a lie when the code changes
- **No "see PR #123" / "added for X flow" comments** — that belongs in the commit message
- **Keep imports ordered** — std → third-party → `@/server/*` → `@/client/*` → `@/shared/*` → relative
- **No re-exports for the sake of re-exports** — `index.ts` files exist only when they shorten a real import path
- **Don't add abstractions for hypothetical future needs** — three similar lines beat a premature wrapper

---

## React Effects

- **Don't use `useEffect` for derived state** — compute it during render or with `useMemo`
- **Don't use `useEffect` for events** — use the event handler that triggered the change
- **Don't use `useEffect` to fetch data** — use a TanStack Query hook (`useMovies`, `useInstances`, etc.)
- **Do use `useEffect`** for: subscribing to external systems (timers, event listeners, browser APIs) — and always return a cleanup function
- **Empty dependency arrays are a smell** — verify the effect truly only runs once; if you're using it as `componentDidMount`, you almost certainly want a query, a ref, or render-time logic instead
- **`useMemo`/`useCallback`** — only when profiling shows a real cost; default to neither

---

## API & Database Change Rules

### Adding an endpoint

1. Create the route file under `src/app/api/<path>/route.ts`
2. Wrap the handler with `createApiHandler()` from `src/server/lib/handler.ts`
3. **Auth is automatic.** Middleware denies by default. To make a route public, add it to `PUBLIC_API_PATHS` / `PUBLIC_PAGE_PATHS` in `src/proxy.ts`. **Justify it in the PR.** Almost no new endpoint should be public.
4. Define a zod schema for any body in `src/shared/types/schemas.ts` and call `parseJson(req, schema, "Invalid …")` from `api-errors.ts` at the top of the handler. The helper does `req.json()` + `safeParse` + throws `ZodPayloadError` mapped to 400 by `createApiHandler`.
5. Define request/response types in `src/shared/types/api.ts` — never inline in the route. The error JSON shape is the shared `ApiErrorResponse` (`{ error, code?, traceId }`); do not invent a different envelope.
6. Use `PaginatedResponse<T>` for list endpoints — never define an ad-hoc shape
7. **Never return `Instance` (with `apiKey`) to the client.** Map to `InstanceListItem` in the route. Same rule for any future entity that holds a secret.
8. Add a TanStack Query hook in `src/client/hooks/` and a query key in `src/client/lib/query-keys.ts`. The mutation throws `ApiClientError` directly — don't wrap in a domain-specific subclass; switch on `status` / `code` at the call site.
9. **Errors via `throw` not `return`.** Use the helpers in `src/server/lib/api-errors.ts`: `badRequest(msg, code?)`, `unauthorized(msg?, code?)`, `notFound(msg?)`, `conflict(msg, code?)`, `tooManyRequests(msg, retryAfterMs?, code?)`, `internal(msg?, ctx?)`. They produce the canonical `ApiErrorResponse`. `HttpError` set with `logLevel: "warn" | "error"` also writes to `appLogger` automatically.

### Database migrations

- New table or column → `yarn prisma migrate dev --name <descriptive_snake_case>`
- **Never edit a migration that has already been applied to any environment** — create a new one
- **Never delete a migration** — they are append-only history
- After schema changes: run `yarn prisma generate` and update the affected repository
- Cross-table queries that don't fit existing repos → new method on the relevant repo, not loose Prisma calls in services

### Mutations

- All media mutations go through `MediaService.executeAction()` — guarantees dry-run check + ActionLog write
- Never call `RadarrClient.deleteFile()` etc. directly from a route handler

---

## Security: hard rules

These are the patterns that turned the Huntarr disclosure (Reddit r/selfhosted, late 2025) into a panic — **unauthenticated config endpoints, plaintext credentials, allow-list-shaped auth, body-flag bypasses, X-Forwarded-For trust, Zip Slip**. Treat them as tripwires. If a change appears to require breaking one, stop and reconsider — the rule is the answer, not the feature.

### Always

- **Deny by default in [`src/proxy.ts`](src/proxy.ts).** Every new route is private until explicitly listed in `PUBLIC_API_PATHS`/`PUBLIC_PAGE_PATHS`. Justify any addition.
- **Auth signals come from cookie / `X-Api-Key` (timingSafe) / configured proxy header — in that order.** Never from request bodies, query params, or `X-Forwarded-For`.
- **Encrypt at rest.** Anything that's a credential goes through `encryptSecret`/`decryptSecret` from `src/server/lib/crypto.ts`. The `Instance.apiKey` row is already wrapped — keep it that way.
- **Strip secrets from API responses.** Use `InstanceListItem` (no `apiKey`) for client-bound JSON. `/api/config` returns `dryRun` and `scoringModes` only — the `X-Api-Key` is fetched separately via `/api/config/api-key` with password re-auth.
- **Validate every body with zod** from `src/shared/types/schemas.ts`. `safeParse` → 400 on failure.
- **Pass user-supplied URLs through `assertSafeArrUrl`** at write time AND in `ArrClient`'s constructor.
- **Redact before logging.** `appLogger` already calls `redactContext`; if you log a string body, wrap it in `redactString` (see `ArrClient.fetch`).
- **Use `useConfirm()` (shadcn AlertDialog) for destructive confirms.** Never browser-native `confirm()`.

### Never

- ❌ A route that "doesn't need auth because it's read-only"
- ❌ A request body field that flips auth state — `setup_mode`, `local`, `internal`, `bypass_csrf`, anything similar
- ❌ Returning `Instance` (with `apiKey`) to a client component or React Query hook
- ❌ Reading `X-Forwarded-For` to decide whether something is "local"
- ❌ An "admin reset" / "clear setup" endpoint that bypasses the existing `User`
- ❌ File uploads, archive extraction (`zipfile.extractall`-equivalents), or filesystem paths derived from request data — these enable Zip Slip / path traversal. If a feature seems to require it, escalate; do not just implement it
- ❌ `child_process` with concatenated args, `vm.runInThisContext`, `eval`, `new Function(...)`, or dynamic `require()`
- ❌ Logging a request body, response body, URL with credentials, or session token without going through `redactString` / `redactContext`

### When changing auth or secret-handling code

You are touching a load-bearing layer. The PR description must include:

1. Which file in `src/server/lib/` you touched and why
2. The exact set of routes whose auth behavior changes (use `git grep` to find route files, do not guess)
3. A `curl` repro for each Huntarr-style attempt that should still fail (unauth config dump, body-flag bypass, X-Forwarded-For spoof, secret round-trip)

---

## Commit & Pull Request Guidelines

### Format

```text
<type>: <imperative subject, ≤ 72 chars>

<optional body — wrap at 72 cols, explain WHY, not WHAT>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`, `test`.

### Subject rules

- Imperative mood: "add X", not "added X" or "adds X"
- No trailing period
- Reference issue numbers when applicable: `fix: prevent NaN on slider drag (#42)`

### Body rules

- Explain **why** the change is needed, not what the diff already shows
- One PR = one logical change; if you can describe it with "and", split it

### NEVER add to commits or PRs

- ❌ `🤖 Generated with <AI tool>` (or any "Generated with" footer)
- ❌ `Co-Authored-By: Claude <noreply@anthropic.com>`, `Co-Authored-By: Cursor`, or any AI co-author trailer
- ❌ Any advertising, attribution, or "powered by" line for an AI tool
- ❌ AI-tool-name as the author voice ("I (Claude) did X") — write as the human committer

End the message at the substantive content. No footer, no signature, no marketing.

### Pull Requests

- Title mirrors the commit subject
- Body has two sections: **Summary** (1–3 bullets) and **Test plan** (checklist of what was verified)
- Link the issue if there is one
- Keep diffs focused — incidental cleanup goes in a separate PR

### Branching & cadence

Multi-phase work splits into independent feature branches — one per phase, one squash-merged PR per branch. Phases don't stack.

- Branch names: `feat/<scope>-<short>` (e.g. `feat/v2-mobile-shell`), `fix/<short>`, `chore/<short>`, `docs/<short>`
- Don't squash locally — GitHub squash-merges the PR so the title becomes the single main-line commit
- Bug fix during an in-flight phase: same branch if related; orthogonal fix gets a short-lived `fix/...` off main, merge, then rebase the in-flight branch on top
- Doc updates ride along in the PR that prompted them — never a doc-only follow-up
- Per PR: `yarn lint && yarn tsc --noEmit && yarn test:coverage && yarn test:e2e` all green; coverage stays at the tier defined in `vitest.config.ts` (85% lines/functions/statements; 80% branches repo-wide, 85% branches on server folders)
- **AI agents must not `git push`, open PRs, or merge** without explicit human confirmation. Surface the diff and the proposed message; let the human run the command.

---

## Pre-Commit Checklist

Run all of these before staging. Failure on any → fix before continuing.

- [ ] `yarn tsc --noEmit` — type-check passes
- [ ] `yarn lint` — no errors, no new warnings
- [ ] `yarn build` — production build succeeds (catches RSC/server-import boundary violations that lint may miss)
- [ ] No `console.log`, `debugger`, or commented-out code
- [ ] No new `any` types, `as` casts, or `// @ts-ignore`
- [ ] No `useEffect` smell (see React Effects rules above)
- [ ] If schema changed: migration created, `prisma generate` run, repository updated
- [ ] If endpoint changed: shared type updated, query hook updated, **zod schema added** in `src/shared/types/schemas.ts`
- [ ] If UI changed: smoke-tested at `http://localhost:7272` in dark mode
- [ ] If a new user-facing string was added: key added to `messages/en.json` + `useTranslations()` used (no hardcoded UI text)
- [ ] No new entry in `PUBLIC_API_PATHS` / `PUBLIC_PAGE_PATHS` of `src/proxy.ts` unless explicitly justified
- [ ] No `apiKey` in any client-bound JSON response — `grep -n "apiKey" src/app/api/**/*.ts` shows only encrypt/decrypt usage
- [ ] No `confirm(` in `src/`; destructive confirms use `useConfirm()`
- [ ] Commit message follows the format and contains **no AI attribution**

---

## Conventions Recap

- **Themes** — three named themes (`dark-orange`, `dark-teal`, `light`) via `next-themes`. Brand accent is `--brand` / `text-brand` / `bg-brand`. Never hardcode brand hex values in components.
- **Port 7272** — dev + Docker; do not change
- **OOP server-side** — new logic goes on a class, not a loose function
- **Pages compose focused hooks directly** — no `useFooPage` orchestrator. Movies/shows go through `<MediaListShell>`; pages collapse to per-domain config.
- **Toasts via `withToast()`** — never `toast.*` in mutation callbacks
- **All mutations through `MediaService.executeAction()`** — dry-run + logging guaranteed
- **All UI text via `useTranslations()`** — keys in `messages/en.json`
- **Deny-by-default auth** — the proxy gates everything; do not add per-route bypasses
- **Secrets stay server-side** — `InstanceListItem` (no `apiKey`) for client; `instanceRepository` is the only path that touches `Instance.apiKey`
- **Zod every body** — schemas in `src/shared/types/schemas.ts`, parse via `parseJson(req, schema, msg)` from `api-errors.ts`
- **Errors via `HttpError` server-side, `ApiClientError` client-side** — one class per tier. Wire format defined in `src/shared/types/api.ts` (`ApiErrorResponse`). Server: throw `HttpError` (or use helpers like `badRequest`, `unauthorized`, `parseJson`, `positiveInt` from `src/server/lib/api-errors.ts`). Client: catch `ApiClientError`, switch on `.status` / `.code`. No per-route ad-hoc error JSON, no per-domain client error subclasses.

---

## When in doubt

1. Search the codebase for an existing pattern before inventing one (`grep -r`, IDE find-references)
2. Read the relevant module's existing tests — they document the intended contract
3. Ask the human before introducing a new dependency, a new top-level folder, or a new architectural layer
4. Prefer extending an existing helper (`api-errors.ts`, `redact.ts`, `url-guard.ts`, `BaseRepository<T>`) over forking a new one
