#!/bin/sh
# Seed /config with defaults on first run.
# Never overwrites files that already exist.

DEFAULTS_DIR=/app/config-defaults

for src in "$DEFAULTS_DIR"/*.example; do
  filename=$(basename "$src" .example)
  dest="/config/$filename"
  if [ ! -f "$dest" ]; then
    echo "[entrypoint] Seeding $dest from defaults"
    cp "$src" "$dest"
  fi
done

exec node dist/server.js
