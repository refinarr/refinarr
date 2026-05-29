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

node ./node_modules/prisma/build/index.js migrate deploy
exec node server.js
