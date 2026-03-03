#!/bin/sh
set -e

# Fix volume ownership on every start.
# Handles upgrades where /data or /config was previously owned by root.
chown -R dashdash:dashdash /data /config

# Seed /config with defaults on first run — never overwrites existing files.
DEFAULTS_DIR=/app/config-defaults
for src in "$DEFAULTS_DIR"/*.example; do
  filename=$(basename "$src" .example)
  dest="/config/$filename"
  if [ ! -f "$dest" ]; then
    echo "[entrypoint] Seeding $dest from defaults"
    cp "$src" "$dest"
    chown dashdash:dashdash "$dest"
  fi
done

# Drop from root to dashdash and exec the server.
exec su-exec dashdash node dist/server.js
