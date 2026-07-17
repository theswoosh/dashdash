---
title: SSO / OIDC
weight: 20
---

dashdash can sign users in through any standards-compliant OIDC identity
provider — Keycloak, Authentik, Authelia, and similar all work. This is
configured by whoever runs your dashdash server, using environment
variables (never in the YAML config files).

## Turning it on

Three environment variables enable SSO:

```env
BOARD_OIDC_ISSUER=https://auth.example.com/realms/home
BOARD_OIDC_CLIENT_ID=dashdash
BOARD_OIDC_SECRET=your-client-secret
```

Once all three are set, a "Sign in with SSO" button appears on the login
screen automatically — local login keeps working alongside it unless it's
explicitly disabled.

## What happens on first SSO login

The first person to ever log in — through SSO or a local account — becomes
the admin. Your identity provider must assert that your email address is
verified; if it doesn't, dashdash refuses the login with a clear error
rather than creating an account with an unverified email.

Your display name comes from your identity provider's profile: it prefers
your full name, then a username, then falls back to your email address.

## Mapping groups to the admin role

If your identity provider issues group membership in its tokens, dashdash
can promote members of a specific group to admin automatically on their
first SSO login:

```env
BOARD_OIDC_GROUPS_CLAIM=groups
BOARD_OIDC_ADMIN_GROUP=dashdash-admins
```

`BOARD_OIDC_GROUPS_CLAIM` names the token claim holding your group list;
`BOARD_OIDC_ADMIN_GROUP` is the exact group name that grants admin.

## Linking to an existing local account

If someone with an existing local account signs in via SSO using the same
email address, dashdash links the two by default — that person can then
sign in with either their local password or SSO, and both keep working.

```env
BOARD_OIDC_AUTO_LINK=true   # default
```

Set it to `false` if you'd rather block that instead of linking. With
auto-link off, an SSO login whose email matches an existing local account
is refused with a clear "an account with this email already exists"
error, rather than being linked or creating a duplicate account.

## Logging out

Signing out of dashdash also ends your session with the identity provider,
provided the provider allows dashdash's URL as a logout redirect target.
If your identity provider isn't configured to allow that redirect, your
provider-side session may remain active even though you're signed out of
dashdash locally — this is a setting on the identity provider side, not
something dashdash controls.

## Requested scopes

By default dashdash requests the `openid profile email` scopes. Override
this if your provider needs something different:

```env
BOARD_OIDC_SCOPES=openid profile email groups
```

## Plain-HTTP identity providers

For production, your identity provider must be served over HTTPS. If
you're testing against a provider on your own LAN without TLS, you can opt
in to allow it:

```env
BOARD_OIDC_ALLOW_HTTP=true
```

Leave this unset (or `false`) in any real deployment.
