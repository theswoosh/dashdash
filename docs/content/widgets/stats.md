---
title: System Stats
weight: 30
---

The stats widget shows resource usage for the machine dashdash is running
on: CPU, memory, uptime, disk, and (where available) CPU temperature.

## What it shows

- **CPU** — current utilization
- **Memory** — current usage
- **Uptime** — how long the host has been running
- **Disk** — free space as a percentage, with a threshold bar
- **CPU temperature** — best-effort reading from the host's thermal sensors

Each of these can be shown or hidden independently from the widget's
settings, so you can build a compact widget with just CPU and memory, or a
fuller one with everything.

## Thresholds

CPU and memory each get warning and critical color thresholds (default 65%
warning, 85% critical) so a tile turns amber or red before things get bad.
Thresholds apply to every stats widget on the board at once and are set
from the widget-type defaults rather than per individual tile.

## Disk and temperature availability

Disk usage and CPU temperature are read directly from the host, so their
availability depends on where dashdash is running:

- Disk usage works on standard Linux filesystems and is on by default.
- CPU temperature depends on the host exposing thermal sensor data (via
  `/sys` on Linux); it's off by default because not every host or container
  environment provides it. If your instance's CPU temperature never shows
  a value, that's expected on hosts without exposed thermal sensors — not
  a bug you need to fix.
