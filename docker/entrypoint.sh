#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

if [ "$(id -u)" = "0" ]; then
  groupmod -o -g "$PGID" node 2>/dev/null || groupadd -g "$PGID" node
  usermod -o -u "$PUID" node 2>/dev/null || useradd -u "$PUID" -g "$PGID" node
  chown -R node:node /data /app
  # Ensure the owner can write /data even if the host bind-mount folder was
  # created read-only (e.g. a Synology folder with mode 555) — chown alone
  # doesn't grant write, so `migrate deploy` would fail with "unable to open
  # database file". Root can chmod regardless of the host folder's mode.
  chmod u+rwX /data
  exec su-exec node "$0" "$@"
fi

node ./node_modules/prisma/build/index.js migrate deploy
exec node server.js
