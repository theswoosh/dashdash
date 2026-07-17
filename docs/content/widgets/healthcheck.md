---
title: Healthcheck
weight: 10
---

The healthcheck widget watches whether a service is reachable and shows a
status dot plus, in its full layout, the service name and response time.

## How it checks

What dashdash probes depends on what you give it as a target:

- A bare host or IP address (no scheme, no port) — dashdash sends an ICMP
  ping to check the host is alive.
- A `host:port`, or a URL with an explicit port — dashdash opens a TCP
  connection to that port.
- A plain `http://` or `https://` URL with no port — dashdash opens a TCP
  connection to port 80 or 443.

There are no latency thresholds to configure here — the tile just reports
up, down, or unreachable, plus the response time when it's up.

## Status dot

- **Green (up)** — the target responded.
- **Red (down)** — the target was reached but refused the connection, or
  the check failed outright.
- **Grey (unknown)** — the check couldn't run at all. This is not the same
  as "down": it means dashdash has no reliable answer, usually because ICMP
  isn't available in this environment or no target is configured yet.
- **Pending** — shown briefly while a check is in flight, right after you
  add or edit the widget.

## When a tile turns red: reason codes

Hover the status dot, or open the tile itself, to see why a check failed.
Each reason means something different:

| Reason | What it means | What to do |
|---|---|---|
| Blocked private address | The target is a private/LAN IP and private-network checks are turned off for this install | Ask your admin to enable LAN checks, or point the widget at a public address |
| DNS resolution failed | The hostname didn't resolve to any address | Check the hostname is spelled correctly and is reachable from the server |
| Timed out | The connection attempt took too long | The service may be down, or a firewall is silently dropping the connection |
| Connection refused | Something answered, but nothing is listening on that port | Confirm the service is running and listening on the port you configured |
| Unreachable | The network path to the target failed for some other reason | Check routing/network connectivity between dashdash and the target |
| Invalid host | The target isn't a usable host or URL | Fix the target field's formatting |
| No target configured | The widget has no URL, host, or port set | Add a target in the widget's settings |
| ICMP unavailable | Ping checks aren't permitted in this environment | Use a `host:port` or URL target instead, so dashdash checks via TCP rather than ICMP |

See [Troubleshooting: red tiles]({{< relref "/troubleshooting/red-tiles/" >}}) for a deeper
walkthrough of each case.

## Private network checks

Homelab installs usually want to ping devices on their own LAN
(`192.168.x.x`, `10.x.x.x`, and similar), and dashdash allows that by
default. On a multi-user or internet-exposed install, your admin can turn
this off to stop the server from being used to probe private addresses —
if that's the case, LAN targets will show the "blocked private address"
reason instead of a result.

## Test button

While editing a healthcheck widget, use the **Test** button to run a check
immediately without saving first — it shows you the same status and reason
you'd see on the board, so you can confirm a target works before committing
to it.

## Display options

- **Layout size** — `tiny` collapses the widget to a fixed-height bar
  with the status dot and name; the default full layout adds latency and
  the larger icon.
- **Show name** — choose whether the name appears above or below the
  status, or not at all. If you've set an internal URL for the service,
  the name becomes a link to it.
- **Font size** — small, medium, large, or extra large.
- **Icon** — pick a service icon so you can recognize it at a glance.
