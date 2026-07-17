---
title: Red & Grey Tiles
weight: 10
---

A healthcheck tile turns red when it can reach a target but the check
failed, or grey when it can't get a reliable answer at all. Here's what
each one means and what to try.

| What you see | Likely cause | What to try |
|---|---|---|
| "Blocked private address" | The target is a private/LAN address and this install has private-network checks turned off | Ask your admin to set `allowPrivateNetworks: true` in `settings.yml`, or point the widget at a reachable public address |
| "DNS resolution failed" | The hostname doesn't resolve | Check for typos in the hostname; confirm the server can resolve it (it may not share your machine's DNS/hosts setup) |
| "Timed out" | No response arrived in time | The service is likely down, or a firewall between dashdash and the target is silently dropping traffic |
| "Connection refused" | Something answered at that address, but nothing is listening on the port you specified | Check the service is actually running, and that you have the right port |
| "Unreachable" | The network path failed for some other reason | Check routing and connectivity between the dashdash host and the target |
| "Invalid host" | The target field isn't a usable host, `host:port`, or URL | Fix the formatting of the target in the widget's settings |
| "No target configured" | The widget's target field is empty | Add a host, `host:port`, or URL in the widget's settings |
| "ICMP unavailable" | You gave a bare host/IP (which triggers a ping check), but ping isn't permitted in this environment | Switch the target to `host:port` or a URL — this makes dashdash check via a TCP connection instead of ping, which works everywhere |

## Stuck on "Checking…"

This means a check is in flight. If it never resolves, the server may be
unable to reach the target at all in a way that produces a definitive
answer — try the Test button in the widget's settings to see the exact
reason, and check the table above.

## ICMP checks don't work in my container

Ping (ICMP) checks need a network capability that isn't always granted to
containers by default. If ping checks consistently show "ICMP unavailable,"
the easiest fix on your end is to give the widget a port to check instead
of a bare host — a `host:port` target uses a TCP connection, which doesn't
need any special capability.

## A LAN target is blocked even though it should work

If a tile for a `192.168.x.x`, `10.x.x.x`, or similar address shows
"blocked private address," your admin has explicitly turned off
private-network checks — usually intentional on a multi-user or
internet-exposed install, since allowing it would let anyone with access to
the dashboard probe your internal network. Ask your admin if this should be
re-enabled for your setup.
