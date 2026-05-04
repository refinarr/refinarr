# Refinarr

Self-hosted dashboard that connects to Sonarr/Radarr, identifies media missing your wanted Custom Formats, and gives you bulk cleanup tools. Runs on port **7272**.

## Quick start

```bash
# Dev
yarn install
yarn prisma migrate dev
yarn dev

# Docker
docker compose up -d
```

On first launch, navigate to `http://<host>:7272` — you will be redirected to `/setup` to create the admin account.

## Threat model and security

Refinarr stores the API keys for your Sonarr/Radarr instances. Treat the data volume the same as you would treat those keys — back it up encrypted, do not share it, and rotate downstream API keys after suspected compromise.

**Defaults you should know about:**

- Every page and API route is gated by a deny-by-default auth proxy ([`src/proxy.ts`](src/proxy.ts), Next.js 16's renamed Middleware). The only public surfaces are `/api/health`, `/login`, and (only while no user exists) `/setup`.
- Passwords are hashed with scrypt; sessions are random 32-byte tokens stored httpOnly + sameSite=strict.
- Sonarr/Radarr API keys are stored encrypted at rest with AES-256-GCM. The encryption key lives at `/data/.encryption-key` (auto-generated on first start, mode 0600) or via the `ENCRYPTION_KEY` env var (32 bytes base64). Lose the key → existing instance keys are unrecoverable; you will need to re-add the instances.
- API keys for connected *arr apps are **never** returned to the browser. They never leave the server-side code path that talks to Sonarr/Radarr.
- Refinarr has no telemetry, no analytics, and makes no outbound HTTP calls except to your configured *arr instances.
- The Node process inside the container does not run as root.

**Public exposure:**

Refinarr **must not be exposed to the public internet** without a reverse proxy you trust to do TLS and (optionally) external auth. The built-in login is good for a private LAN; it is not designed to be the only thing between the internet and your media server.

**Reverse-proxy auth (Authelia / Authentik / Caddy / etc):**

Refinarr can trust a username header from a reverse proxy that has already authenticated the user. Off by default. Enable it like:

```env
TRUST_PROXY_AUTH=true
PROXY_USER_HEADER=X-Remote-User   # default; change if your proxy sets a different header
```

Only enable this when refinarr is bound to a private interface that **only** the trusted proxy can reach. Anything else can spoof the header. Refinarr deliberately does **not** read `X-Forwarded-For` or any IP header for auth decisions.

**API access from scripts:**

The `X-Api-Key` header is honored for non-browser callers. The key is shown (and rotatable) in Settings → API Access; both reveal and rotate require your password again. Keep the key out of shell history and version control.

## What we deliberately don't do

- **No file uploads, no archive extraction, no path-from-input filesystem access.** This eliminates Zip Slip and path-traversal vulnerability classes entirely.
- **No client-controlled flags that bypass auth.** Auth state never comes from a request body or URL parameter.
- **No allow-list-shaped auth.** Every route is private unless explicitly listed as public — there is no "skip auth for X" code path.

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

## Stack

- Next.js App Router, TypeScript, Tailwind 4, shadcn/ui (3 themes: dark-orange, dark-teal, light)
- Prisma 7 + SQLite
- TanStack Query v5
- next-intl
- pino
