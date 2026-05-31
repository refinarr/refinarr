# Contributing to refinarr

Thanks for your interest in contributing. This document covers what you need to know to get a working dev environment and open a PR that's likely to merge.

## Dev setup

Prerequisites:

- Node.js 22+ (see `.nvmrc` if present, or `package.json` `engines`)
- Yarn 1.x (`corepack enable` will install it)
- Docker (only needed if you want to test the production image; not required for dev)

```bash
git clone https://github.com/refinarr/refinarr.git
cd refinarr
yarn install        # also runs `prisma generate`
yarn prisma migrate dev
yarn dev            # starts on :7272
```

First boot redirects to `/setup` — create the admin account, then add a Sonarr/Radarr instance from Settings.

## Test + lint

```bash
yarn lint           # prettier + eslint
yarn tsc --noEmit   # type check
yarn test           # vitest (unit + integration + component)
yarn test:e2e       # playwright (separate dev server on :7373)
yarn build          # production build — catches RSC boundary violations
```

CI runs all of the above. Coverage threshold is 85% on `lines/branches/functions/statements` for `server/lib/**`, `server/repositories/**`, `server/services/**`, `client/lib/**`, and `shared/**`.

## Branching + PRs

- All PRs target the **`main`** branch (single-branch GitHub Flow)
- Branch names: `feat/<scope>-<short>`, `fix/<short>`, `chore/<short>`, `docs/<short>`
- **Conventional Commit titles** — release-please reads them to compute the next version:
  - `feat:` → MINOR bump (new user-visible behavior)
  - `fix:` → PATCH bump (bug fix)
  - `feat!:` / `BREAKING CHANGE:` footer → MAJOR bump
  - `chore:` / `refactor:` / `docs:` / `test:` / `ci:` → no release impact
- GitHub squash-merges PRs, so the PR title becomes the single commit on `main`
- Per PR: `yarn lint && yarn tsc --noEmit && yarn test && yarn build` must all pass; coverage stays ≥ 85%

## Code conventions

The repo enforces a layered architecture:

- `src/server/` — backend only (never imported by client code)
- `src/client/` — frontend only (never imported by server code)
- `src/shared/` — safe everywhere (types/DTOs only, no runtime deps)
- `src/app/` — Next.js pages + thin API route controllers

`eslint-plugin-boundaries` enforces this in CI.

Other rules to know:

- **Always `interface Props`** for components — never inline prop types
- **Shared union types** for domain values (`ScoringMode`, `ArrType`, etc.) — never `string`
- **All user-facing strings** via `useTranslations()` — keys in `messages/en.json`
- **All mutation routes** parse with zod via `parseJson(req, schema, msg)`
- **Toasts** via `withToast()` — never call `toast.*` directly
- **All actions** go through `MediaService.executeAction()` — dry-run + ActionLog logging guaranteed
- **No comments** that explain WHAT — only WHY when it's non-obvious

## Adding a new `*arr` type

refinarr is a module map: a new product (Lidarr, Whisparr, …) is a couple of
data rows (`ARR_META`, `ARR_UI`) plus one module file, and most UI surfaces
(sidebar nav, command palette, dashboard, queue dispatch) auto-wire from those
registries. The full step-by-step — client/service/module, API routes, the
per-type UI set, i18n, and tests — is in
**[docs/adding-an-arr-type.md](docs/adding-an-arr-type.md)**.

Lidarr and Whisparr are wanted — grab a [`help wanted`](https://github.com/refinarr/refinarr/labels/help%20wanted) issue if you'd like to take one on.

## Security-sensitive PRs

PRs touching authentication, encryption, the auth proxy, or upstream URL validation get extra scrutiny via `.github/CODEOWNERS`. The maintainer is auto-requested. These paths matter:

- `src/proxy.ts` — the deny-by-default auth gate
- `src/server/lib/auth.ts` — password hashing, sessions
- `src/server/lib/crypto.ts` — AES-256-GCM for at-rest secrets
- `src/server/lib/url-guard.ts` — SSRF guard for user-supplied *arr URLs
- `src/server/lib/redact.ts` — secret scrubbing for logs

If you're adding a new API route, do NOT re-check auth in the handler — the proxy already enforces it. Just use `createApiHandler()` for traceId + error dispatch.

## Reporting vulnerabilities

Please see [SECURITY.md](SECURITY.md) — don't open public issues for security problems.

## License

By contributing, you agree your contribution is licensed under the [GNU General Public License v3.0](LICENSE).
