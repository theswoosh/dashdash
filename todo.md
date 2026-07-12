# dashdash TODO

## ✅ RESOLVED — ICMP ping in unprivileged LXC (was: sysctl fails to start container)

**Was:** `docker-compose.yml` set `sysctls: net.ipv4.ping_group_range` so the
unprivileged app user could send ICMP pings. Unprivileged Proxmox LXCs can't
write that namespaced sysctl into the container's net namespace (`EINVAL`), so
the container failed to start entirely. A workaround stripped the `sysctls:`
block after each pull, which silently disabled ping.

**Fix (2026-06-18):** dropped the sysctl; ICMP now uses **`CAP_NET_RAW`**, handed
to the non-root `dashdash` user as an **ambient capability** by the entrypoint
(`setpriv --ambient-caps +net_raw`, replacing `su-exec`). This works under
`no-new-privileges` + `cap_drop: ALL`, needs no sysctl, and works in unprivileged
LXC (Proxmox grants `NET_RAW` by default). Changes:

- `docker-compose.yml` — `cap_add: [… , NET_RAW]`; sysctl removed.
- `Dockerfile` — install `setpriv` instead of `su-exec`.
- `docker/entrypoint.sh` — detect `CAP_NET_RAW` in `CapEff`; if present, drop to
  `dashdash` with ambient `net_raw`; else drop without it and log a notice (app
  still starts; ICMP-only checks then report `unknown`).
- `check.ts` — a bare host/IP with no port now uses **ICMP ping** (was TCP:80);
  a port / `host:port` / `http(s)://` URL still uses a **TCP** check. When ICMP
  can't run, the result is `status: 'unknown'` (grey dot) instead of a false
  `down`.

**Validate in the LXC:** `cap_add: NET_RAW` must be permitted by the LXC. Confirm
the container starts and a bare-host healthcheck shows up/down (not perpetually
`unknown`). If your LXC blocks `NET_RAW`, either allow it in the LXC config or
use port/URL (TCP) healthchecks.
