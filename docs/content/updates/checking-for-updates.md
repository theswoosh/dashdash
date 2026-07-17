---
title: Checking for Updates
weight: 10
---

## Seeing your version

Open the config panel and click the **Info** button to see the version
your instance is running, along with support and license information.

## The update indicator

If a newer release is available, the Info button shows a small dot, and
the info panel shows your current version alongside the latest one as a
link straight to its release notes on GitHub.

Checking for updates requires your admin to have set a GitHub access token
on the server (`BOARD_GITHUB_TOKEN`). Without it, the update check is
simply a no-op — no error, no indicator, dashdash just doesn't know whether
a newer version exists. If you never see an update indicator and expect
one, that's the first thing to ask your admin about.

## Applying an update

Updating is a server-side action — pulling the newest Docker image and
restarting the container. See [Install & first run]({{< relref "/getting-started/install/" >}}#updating)
for the exact steps if you run the server yourself; otherwise, ask whoever
manages your dashdash install.

## Image tags

If you manage the server yourself, the Docker image is published under a
few different tags depending on how precisely you want to pin your
version:

- `latest` — always the newest build from the main branch
- a specific version, e.g. `0.1.0` — pinned to exactly that release
- a shortened version, e.g. `0.1` — tracks patch updates within that minor
  version
- a `sha-` prefixed tag — pinned to an exact build, useful for debugging
