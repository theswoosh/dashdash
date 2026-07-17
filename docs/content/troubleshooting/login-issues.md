---
title: Login Issues
weight: 20
---

## "Too many attempts" on login

Local login is limited to 5 attempts per 15 minutes, per email address —
this protects accounts against brute-force password guessing. If you hit
this, wait out the 15-minute window; a successful login resets the count.
There's no way to bypass the wait except having an admin reset your
password for you in the meantime.

## Registration or password reset refuses to proceed

Registration is limited to 3 new accounts per hour, per IP address, and
password-reset requests are limited to 3 per hour, per email address. Both
protect against abuse of open registration and the mail system. Wait out
the hour, or ask your admin if a limit seems wrong for your situation.

## Password reset link never arrives

Password reset emails only go out if your admin has configured outgoing
mail (SMTP) for the server. If mail isn't configured, the "forgot
password" flow has nothing to send through — check with your admin, who
can reset your password directly from the admin panel instead.

## SSO login errors

If your dashdash install has SSO configured, you may see one of these
errors after signing in through your identity provider:

- **"Email not verified"** — your identity provider didn't assert your
  email address as verified. dashdash requires a verified email for SSO
  logins; verify your email with your identity provider and try again.
- **"An account with this email already exists"** — a local account
  already uses your email, and this install has automatic account linking
  turned off. Ask your admin to either enable auto-linking or manage the
  conflict manually.
- **A generic state/configuration error** — this usually means the login
  attempt took too long (the request expired) or the SSO setup on the
  server has a problem. Try signing in again; if it persists, this is one
  for your admin to check on the server side.
