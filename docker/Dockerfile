FROM node:22-alpine AS base

# su-exec for privilege dropping; shadow provides groupmod/usermod/groupadd/useradd
# (Alpine ships only BusyBox addgroup/adduser, which the entrypoint's PUID/PGID
# remap of the existing `node` user cannot use) — without it the entrypoint
# crash-loops with "groupadd: not found" and the app never starts.
RUN apk add --no-cache su-exec shadow

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
# Copy prisma/ BEFORE yarn install — the postinstall hook runs
# `prisma generate` which requires prisma/schema.prisma. Without
# this, multi-arch builds fail at the deps layer with
# "Could not find Prisma Schema".
COPY prisma ./prisma
RUN yarn install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV DATABASE_URL=file:///data/data.db
RUN npx prisma generate
RUN yarn build

# ---------- runner ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7272
# Docker sets HOSTNAME to the container ID; Next's standalone server binds to
# it, leaving the app unreachable through a published port. Force 0.0.0.0 so
# `-p` mappings work on real hosts (Synology, etc.).
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:///data/data.db

RUN mkdir -p /data

# Standalone server (server.js + Next's traced node_modules) and static assets.
# No public/ copy: the repo has no public/ assets (the Next scaffold SVGs were
# removed), so `next build` produces no /app/public and the standalone server
# serves from .next/static; re-add `COPY --from=builder /app/public ./public`
# if public/ assets ever return.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# --- prisma CLI for `migrate deploy` (run by entrypoint.sh) ---
# Next's standalone trace only bundles what the APP imports (@prisma/client),
# not the `prisma` CLI. Prisma 7 loads prisma.config.ts via @prisma/config,
# which (plus @prisma/dev at CLI bootstrap) needs deps Next never traces. We
# copy the EXACT runtime closure of `prisma migrate`, captured by tracing
# Module._resolveFilename on prisma 7.8 — this is the maintainer-endorsed
# selective-copy pattern (prisma/prisma#28759), not a full node_modules
# (which would also drag in prisma studio + pglite/mysql2/postgres, ~+765MB
# the migrate path never loads). The RUN smoke test below guarantees this
# list stays complete: a future Prisma bump that needs a new module fails
# THIS build, not the user's container.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/effect ./node_modules/effect
COPY --from=builder /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder /app/node_modules/pure-rand ./node_modules/pure-rand
COPY --from=builder /app/node_modules/get-port-please ./node_modules/get-port-please
COPY --from=builder /app/node_modules/graceful-fs ./node_modules/graceful-fs
COPY --from=builder /app/node_modules/jiti ./node_modules/jiti
COPY --from=builder /app/node_modules/pathe ./node_modules/pathe
COPY --from=builder /app/node_modules/proper-lockfile ./node_modules/proper-lockfile
COPY --from=builder /app/node_modules/remeda ./node_modules/remeda
COPY --from=builder /app/node_modules/retry ./node_modules/retry
COPY --from=builder /app/node_modules/signal-exit ./node_modules/signal-exit
COPY --from=builder /app/node_modules/std-env ./node_modules/std-env
COPY --from=builder /app/node_modules/valibot ./node_modules/valibot
COPY --from=builder /app/node_modules/zeptomatch ./node_modules/zeptomatch
# zeptomatch's ESM deps (missed by the CJS require trace; surfaced by the smoke test)
COPY --from=builder /app/node_modules/grammex ./node_modules/grammex
COPY --from=builder /app/node_modules/graphmatch ./node_modules/graphmatch
# @prisma/config's config-loader closure: prisma.config.ts is a .ts file loaded
# at runtime via @prisma/config → c12 (+jiti) → the unjs loader tree. Prisma 7
# forbids `url` in schema.prisma (P1012), so this loader is mandatory for
# `migrate deploy`. Full transitive closure of @prisma/config (these are ESM
# imports the CJS trace couldn't see; the smoke test confirms completeness).
COPY --from=builder /app/node_modules/@standard-schema ./node_modules/@standard-schema
COPY --from=builder /app/node_modules/c12 ./node_modules/c12
COPY --from=builder /app/node_modules/chokidar ./node_modules/chokidar
COPY --from=builder /app/node_modules/confbox ./node_modules/confbox
COPY --from=builder /app/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=builder /app/node_modules/defu ./node_modules/defu
COPY --from=builder /app/node_modules/destr ./node_modules/destr
COPY --from=builder /app/node_modules/empathic ./node_modules/empathic
COPY --from=builder /app/node_modules/exsolve ./node_modules/exsolve
COPY --from=builder /app/node_modules/giget ./node_modules/giget
COPY --from=builder /app/node_modules/ohash ./node_modules/ohash
COPY --from=builder /app/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=builder /app/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=builder /app/node_modules/rc9 ./node_modules/rc9
COPY --from=builder /app/node_modules/readdirp ./node_modules/readdirp
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Smoke test: run the real `migrate deploy` against a throwaway DB so the
# build FAILS if the copied closure above is missing any module the CLI
# loads (the failure mode that produced prisma/prisma#28759). Same-RUN
# cleanup leaves no artifact in the shipped layer.
RUN DATABASE_URL="file:/tmp/smoke.db" \
      node ./node_modules/prisma/build/index.js migrate deploy \
    && rm -f /tmp/smoke.db

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7272
VOLUME ["/data"]
ENTRYPOINT ["/entrypoint.sh"]
