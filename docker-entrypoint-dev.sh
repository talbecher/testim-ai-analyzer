#!/bin/sh
set -e
cd /app
if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock-hash ] || [ "$(cat node_modules/.package-lock-hash 2>/dev/null)" != "$(cksum package-lock.json | awk '{print $1}')" ]; then
  echo "[docker-dev] Installing / syncing npm dependencies..."
  npm ci
  cksum package-lock.json | awk '{print $1}' > node_modules/.package-lock-hash
fi
exec "$@"
