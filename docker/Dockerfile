FROM node:22-alpine AS base

# Install su-exec for privilege dropping
RUN apk add --no-cache su-exec

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
ENV DATABASE_URL=file:///data/data.db

RUN mkdir -p /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# prisma CLI (for migrate deploy) + dotenv (required by prisma.config.ts)
# bundled so the container never downloads anything at runtime.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7272
VOLUME ["/data"]
ENTRYPOINT ["/entrypoint.sh"]
