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
#
# If the container was granted CAP_NET_RAW (cap_add: NET_RAW), pass it through
# as an ambient capability so the non-root app can send ICMP pings (healthcheck
# widget) — this survives no-new-privileges and needs no ping_group_range sysctl
# (so it works in unprivileged LXC). If NET_RAW isn't present, drop privileges
# without it: the app still starts and ICMP-only checks report "unknown" while
# port/URL (TCP) checks keep working.
CAP_NET_RAW_MASK=8192   # 1 << 13

cap_eff_hex=$(awk '/^CapEff:/ { print $2 }' /proc/self/status)
if [ -n "$cap_eff_hex" ] && [ "$(( 0x$cap_eff_hex & CAP_NET_RAW_MASK ))" -ne 0 ]; then
  exec setpriv --reuid dashdash --regid dashdash --init-groups \
    --inh-caps +net_raw --ambient-caps +net_raw -- node dist/server.js
else
  echo "[entrypoint] CAP_NET_RAW not available — ICMP ping disabled (add 'cap_add: [NET_RAW]' to enable); TCP/HTTP healthchecks still work."
  exec setpriv --reuid dashdash --regid dashdash --init-groups -- node dist/server.js
fi
