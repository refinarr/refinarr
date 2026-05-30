#!/usr/bin/env bash
#
# First-run test: spin up the real Docker image FRESH (clean volume, plain HTTP)
# and drive the new-deployment flow in a browser — /setup → create admin →
# /dashboard → reload still authenticated, plus a clean /login round-trip.
#
# This covers the deploy layer the regular e2e suite can't (it runs `next
# start`, not the container): entrypoint/PUID-PGID, prisma migrate deploy, the
# standalone server, HOSTNAME bind, and the session cookie surviving over HTTP.
#
# Usage:
#   bash scripts/first-run-test.sh                 # build from ./docker/Dockerfile
#   IMAGE=ghcr.io/refinarr/refinarr:v0.5.4 bash scripts/first-run-test.sh
#   READONLY=1 bash scripts/first-run-test.sh      # 555 bind mount → tests chmod self-heal
#   PORT=7399 bash scripts/first-run-test.sh
#
# Requires: a LOCAL Docker daemon (the published port must be reachable at
# http://localhost:$PORT) and Playwright's chromium (auto-installed if missing).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-7399}"
NAME="refinarr-firstrun"
VOL="refinarr-firstrun-data"
BINDDIR=""

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOL" >/dev/null 2>&1 || true
  [ -n "$BINDDIR" ] && rm -rf "$BINDDIR" 2>/dev/null || true
}
trap cleanup EXIT
cleanup # start from a clean slate

if [ -n "${IMAGE:-}" ]; then
  echo "▶ using image: $IMAGE"
  docker pull "$IMAGE" >/dev/null
else
  IMAGE="refinarr:first-run-test"
  echo "▶ building image from docker/Dockerfile ..."
  docker build -f docker/Dockerfile -t "$IMAGE" .
fi

if [ "${READONLY:-0}" = "1" ]; then
  BINDDIR="$(mktemp -d)"
  chmod 555 "$BINDDIR" # read-only: exercises the entrypoint's chmod self-heal
  MOUNT=(-v "$BINDDIR:/data")
  echo "▶ data dir: read-only (555) bind mount $BINDDIR"
else
  MOUNT=(-v "$VOL:/data")
  echo "▶ data dir: fresh named volume $VOL"
fi

echo "▶ starting fresh container on :$PORT (plain HTTP) ..."
docker run -d --name "$NAME" -e PUID=1000 -e PGID=1000 "${MOUNT[@]}" \
  -p "$PORT:7272" "$IMAGE" >/dev/null

echo "▶ waiting for /api/health ..."
healthy=0
for _ in $(seq 1 45); do
  if curl -fsS -m 3 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done
if [ "$healthy" != "1" ]; then
  echo "✗ container never became healthy. Logs:"
  docker logs "$NAME" 2>&1 | tail -40
  exit 1
fi
echo "✓ healthy"

# Ensure the browser is present (no-op if cached).
npx playwright install chromium >/dev/null 2>&1 || true

echo "▶ running first-run browser flow ..."
BASE_URL="http://localhost:$PORT" \
  npx playwright test --config playwright.first-run.config.ts

echo "✓ first-run test PASSED"
