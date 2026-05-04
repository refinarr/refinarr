#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

if [ "$(id -u)" = "0" ]; then
  groupmod -o -g "$PGID" node 2>/dev/null || groupadd -g "$PGID" node
  usermod -o -u "$PUID" node 2>/dev/null || useradd -u "$PUID" -g "$PGID" node
  chown -R node:node /data /app
  exec su-exec node "$0" "$@"
fi

# One-time migration shim: pre-rename installs stored the DB at
# /data/remedarr.db. Move it (and its WAL/SHM siblings) to /data/data.db
# the first time we boot under the new name. Skipped once data.db exists,
# so it is a no-op on every subsequent start.
if [ -f /data/remedarr.db ] && [ ! -f /data/data.db ]; then
  mv /data/remedarr.db /data/data.db
  [ -f /data/remedarr.db-journal ] && mv /data/remedarr.db-journal /data/data.db-journal
  [ -f /data/remedarr.db-wal ]     && mv /data/remedarr.db-wal     /data/data.db-wal
  [ -f /data/remedarr.db-shm ]     && mv /data/remedarr.db-shm     /data/data.db-shm
fi

node ./node_modules/prisma/build/index.js migrate deploy
exec node server.js
