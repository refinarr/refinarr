#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

if [ "$(id -u)" = "0" ]; then
  # Run as the operator's UID/GID WITHOUT remapping the built-in `node`
  # user. su-exec accepts a numeric UID:GID and execs as it even when no
  # matching /etc/passwd entry exists, so BusyBox + su-exec alone suffice —
  # no `shadow` package (groupmod/usermod) needed. HOME is set in the image
  # (ENV HOME=/app) so os.homedir() still resolves without a passwd entry.
  chown -R "$PUID:$PGID" /data /app
  # Grant the owner write even if the host bind-mount was created read-only
  # (e.g. a Synology folder with mode 555); chown alone doesn't, and migrate
  # deploy would then fail with "unable to open database file". Root can
  # chmod regardless of the host folder's mode.
  chmod u+rwX /data
  exec su-exec "$PUID:$PGID" "$0" "$@"
fi

# Skip `prisma migrate deploy` when the shipped schema + migrations match
# what was last applied. Hash the schema file AND the migrations dir so a
# new migration (even without a schema.prisma change) still invalidates the
# fingerprint. Any mismatch — including first boot (no fingerprint file) —
# falls through to running migrate deploy, so the safe fallback is always
# "run it" (today's behaviour); the skip only ever fires on a proven match.
FP=/data/.migration-fingerprint
CURRENT=$(
  {
    sha256sum /app/prisma/schema.prisma | cut -d' ' -f1
    find /app/prisma/migrations -type f -name '*.sql' -print0 |
      sort -z |
      xargs -0 sha256sum 2>/dev/null | cut -d' ' -f1
  } | sha256sum | cut -d' ' -f1
)
if [ -f "$FP" ] && [ "$(cat "$FP" 2>/dev/null)" = "$CURRENT" ]; then
  echo "[entrypoint] Schema fingerprint matches — skipping migrate deploy"
else
  echo "[entrypoint] Schema fingerprint changed — running migrate deploy"
  node ./node_modules/prisma/build/index.js migrate deploy
  # Best-effort: if /data is read-only the write fails silently and the next
  # boot simply re-runs migrate deploy.
  echo "$CURRENT" >"$FP" || true
fi

exec node server.js
