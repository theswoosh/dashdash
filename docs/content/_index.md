---
title: dashdash
---

dashdash is a self-hosted dashboard for your homelab: one board for your
services, live-editable, backed by plain YAML you can diff and version.
Drag-and-drop and hand-edited config stay in sync — use whichever fits the
moment. Multi-user from the start, with local accounts or your existing
OIDC provider (Keycloak, Authentik, Authelia, ...).

- **Single container.** One image, two volumes, port 3000. Config is
  seeded on first start.
- **Healthchecks that state their reason** — a red tile tells you
  *timeout* vs *connection refused* vs *DNS failure*, not just "down".
- **No cloud, no telemetry, no external calls from the browser** — API
  credentials stay server-side.

Start with [getting started]({{< relref "/getting-started/" >}}), or jump to
[widgets]({{< relref "/widgets/" >}}) to see what goes on a board.
