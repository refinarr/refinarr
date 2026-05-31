# refinarr

[![CI](https://github.com/refinarr/refinarr/actions/workflows/test.yml/badge.svg)](https://github.com/refinarr/refinarr/actions/workflows/test.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/refinarr/refinarr)](https://github.com/refinarr/refinarr/releases)
[![Docker image](https://img.shields.io/badge/ghcr.io-refinarr%2Frefinarr-blue?logo=docker)](https://github.com/refinarr/refinarr/pkgs/container/refinarr)

Self-hosted dashboard that connects to Sonarr/Radarr, identifies media missing your wanted Custom Formats (HDR / Atmos / DV / etc.), and gives you bulk cleanup tools. Runs on port **7272**.

## Features

- **Per-instance scoring** — manual (pick wanted CFs) or profile (use Sonarr/Radarr's `customFormatScore` cutoff)
- **Bulk actions** — search, delete, ignore across hundreds of items in one pass
- **Auto-runner** (optional) — schedules upgrade searches per instance with rate-limit + cooldown controls
- **Action history** with retry + dry-run mode for everything
- **Multiple Sonarr/Radarr instances** in one dashboard
- **Mobile + desktop** — responsive layout; two brand palettes (amber, teal) × light / dark / system modes
- **No telemetry, no analytics** — outbound calls only to your configured *arr instances

## Quick start

### Docker (recommended)

```yaml
# compose.yml
services:
  refinarr:
    image: ghcr.io/refinarr/refinarr:latest
    container_name: refinarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
      - LOG_LEVEL=info
    volumes:
      - refinarr-data:/data
    ports:
      - "7272:7272"
    restart: unless-stopped

volumes:
  refinarr-data:
```

```bash
docker compose up -d
```

### Dev

```bash
yarn install        # also runs prisma generate
yarn prisma migrate dev
yarn dev            # starts on :7272
```

On first launch, navigate to `http://<host>:7272` — you will be redirected to `/setup` to create the admin account.

## Security

Refinarr stores your Sonarr/Radarr API keys, so it's built defensively:

- **Deny-by-default auth** on every route ([`src/proxy.ts`](src/proxy.ts)) — only `/api/health`, `/login`, and (first-run) `/setup` are public.
- **API keys encrypted at rest** (AES-256-GCM) and never returned to the browser; scrypt passwords; httpOnly + sameSite=strict sessions.
- **No telemetry, no file uploads** — outbound calls only to your *arr instances, which sidesteps Zip Slip / path-traversal entirely.

**Don't expose refinarr to the public internet** without a TLS reverse proxy you trust. Full threat model, reverse-proxy auth setup, and vulnerability reporting → [SECURITY.md](SECURITY.md).

## Configuration

| Env var | Default | What it does |
|---|---|---|
| `LOG_LEVEL` | `info` | pino + DB log threshold (`debug` / `info` / `warn` / `error`) |
| `ENCRYPTION_KEY` | _(auto-generated)_ | 32-byte base64. If set, no key file is written. |
| `ENCRYPTION_KEY_PATH` | `/data/.encryption-key` | Override the on-disk key location |
| `TRUST_PROXY_AUTH` | `false` | Trust an upstream proxy's user header |
| `PROXY_USER_HEADER` | `X-Remote-User` | Header to read the username from when proxy auth is on |
| `PUID` / `PGID` | `1000` / `1000` | UID/GID for the data volume (Docker only) |
| `TZ` | `UTC` | Timezone |

## API

Refinarr exposes a JSON API under `/api` (same auth as the UI — session cookie or `X-Api-Key`). One thing to know if you script against it:

- **Search dispatch is asynchronous.** `POST /api/radarr/movies/search` (and the Sonarr equivalents) returns `202 {"queued": true, ...}` meaning _accepted for processing_, not _completed_. A background worker drains the queue and talks to your *arr; the **terminal** outcome (success / failed) lands in **`GET /api/history`**. Check there for the real result rather than treating the `202` as success. (Delete, by contrast, responds synchronously with its result.)

## Stack

- Next.js App Router, TypeScript, Tailwind 4, shadcn/ui — 2 brand palettes (amber, teal) × light / dark / system
- Prisma 7 + SQLite
- TanStack Query v5
- next-intl
- pino

## License

Copyright (c) 2025-2026 refinarr contributors.

Licensed under the [GNU General Public License v3.0](LICENSE).
