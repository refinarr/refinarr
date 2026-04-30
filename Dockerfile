FROM node:22-alpine AS base

# Install su-exec for privilege dropping
RUN apk add --no-cache su-exec

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV DATABASE_URL=file:///data/remedarr.db
RUN npx prisma generate
RUN yarn build

# ---------- runner ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7272
ENV DATABASE_URL=file:///data/remedarr.db

RUN mkdir -p /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7272
VOLUME ["/data"]
ENTRYPOINT ["/entrypoint.sh"]
