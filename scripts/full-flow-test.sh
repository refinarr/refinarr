#!/usr/bin/env bash
#
# Full-flow test against a REAL Sonarr/Radarr: spin up the real image FRESH
# (clean volume, plain HTTP), then drive the whole journey in a browser —
# setup → login → add YOUR instance → live connection test → real media list.
#
# SAFE: the fresh container defaults dryRun=true and this flow performs only
# read + the built-in connection test. It does NOT delete or search, so it
# never mutates your library. The API key is never printed.
#
# The container must be able to REACH your *arr over the network — run this on a
# host on the same LAN as Sonarr/Radarr (e.g. the NAS, or a box that can hit it).
#
# Usage:
#   ARR_URL=http://10.10.1.50:7878 ARR_KEY=xxxxxxxx \
#     bash scripts/full-flow-test.sh                       # radarr (default)
#
#   ARR_TYPE=sonarr ARR_URL=http://10.10.1.50:8989 ARR_KEY=xxxxxxxx \
#     bash scripts/full-flow-test.sh
#
#   IMAGE=ghcr.io/refinarr/refinarr:v0.5.4 ARR_URL=... ARR_KEY=... \
#     bash scripts/full-flow-test.sh                       # test a published tag
#
# Requires: a LOCAL Docker daemon (port reachable at http://localhost:$PORT),
# Node/Yarn, and Playwright chromium (auto-installed).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ARR_URL:?Set ARR_URL to your Sonarr/Radarr base URL (e.g. http://10.10.1.50:7878)}"
: "${ARR_KEY:?Set ARR_KEY to your Sonarr/Radarr API key}"
ARR_TYPE="${ARR_TYPE:-radarr}"
PORT="${PORT:-7399}"
NAME="refinarr-fullflow"
VOL="refinarr-fullflow-data"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOL" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

if [ -n "${IMAGE:-}" ]; then
  echo "▶ using image: $IMAGE"
  docker pull "$IMAGE" >/dev/null
else
  IMAGE="refinarr:full-flow-test"
  echo "▶ building image from docker/Dockerfile ..."
  docker build -f docker/Dockerfile -t "$IMAGE" .
fi

echo "▶ starting fresh container on :$PORT (plain HTTP, dryRun defaults ON) ..."
docker run -d --name "$NAME" -e PUID=1000 -e PGID=1000 \
  -v "$VOL:/data" -p "$PORT:7272" "$IMAGE" >/dev/null

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

npx playwright install chromium >/dev/null 2>&1 || true

echo "▶ running full flow (type=$ARR_TYPE → $ARR_URL) ..."
# ARR_KEY is passed through the environment only — never echoed.
BASE_URL="http://localhost:$PORT" \
  ARR_TYPE="$ARR_TYPE" ARR_URL="$ARR_URL" ARR_KEY="$ARR_KEY" \
  INSTANCE_NAME="${INSTANCE_NAME:-Full Flow Test}" \
  npx playwright test --config playwright.full-flow.config.ts

echo "✓ full-flow test PASSED"
