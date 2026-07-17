---
title: Accounts & Profiles
weight: 10
---

dashdash supports local accounts (email + password) and, if your admin has
configured it, single sign-on. This page covers local accounts; see
[SSO / OIDC]({{< relref "/users-and-sso/sso/" >}}) for signing in through an identity
provider.

## Registration and the first account

Registration is open from the login screen unless an admin has turned it
off. The very first account ever created on an install — local or SSO —
automatically becomes the **admin** account. Every account after that
starts as a regular user.

## Roles

There are two roles: regular user and admin. Admins can manage other
accounts, search engines, and configuration validation from the admin
panel; regular users manage their own profile and layout.

## Your profile

From the config panel, you can update your own name, email, and password
at any time, and delete your own account if you no longer want it. You can
also set a personal chat color, which overrides the automatically assigned
color used in the chat widget.

## Password reset

If you forget your password, use the "forgot password" link on the login
screen. This only works if your admin has configured outgoing mail
(SMTP) — without it, the reset link has nothing to send email through, and
you'll need an admin to reset your password for you instead.

Reset links are single-use and expire after an hour. Completing a reset
signs you out of every device you were logged in on, not just the one you
used to reset it.

## Rate limits

To stop brute-force attempts, dashdash limits how often you can try
certain actions:

- **Login:** 5 attempts per 15 minutes, per email address. A successful
  login resets the count.
- **Registration:** 3 new accounts per hour, per IP address.
- **Forgot password:** 3 requests per hour, per email address.

These limits persist even if the server restarts, so waiting out a lockout
is the only way past it.
