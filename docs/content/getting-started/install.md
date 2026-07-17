---
title: Install & First Run
weight: 10
---

dashdash ships as a single Docker image. You need Docker and Docker Compose
installed; nothing else.

## Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  dashdash:
    image: ghcr.io/theswoosh/dashdash:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
      - ./data:/data
    restart: unless-stopped
```

`./config` holds your YAML configuration and is where you'll drop credentials
via environment variables. `./data` holds the SQLite database — accounts,
sessions, chat history, notepad content.

## First start

No config preparation needed: on first start the container seeds
`settings.yml` and `services.yml` into your `config/` volume from its
bundled, annotated examples. Files you've already created are never
touched — the seed only fills gaps. `integrations.yml` is optional and
only needed once you wire up named API integrations. See
[Configuration files]({{< relref "/configuration/files/" >}}) for what each file controls.

```bash
docker compose up -d
```

Open `http://localhost:3000`. You'll land on a login screen with a
**Register** link — dashdash starts with no accounts at all.

Register the first account — it becomes the **admin**,
regardless of sign-up method (local password or SSO). Every later account
starts as a regular user; admins promote others from the admin panel.

Once you're logged in, dashdash drops you on a starter board with a handful
of example widgets — see [Your first board]({{< relref "/getting-started/first-board/" >}})
for a tour.

## Updating

Pull the new image and recreate the container:

```bash
docker compose pull
docker compose up -d
```

Your `config/` and `data/` volumes persist across updates. See
[Checking for updates]({{< relref "/updates/checking-for-updates/" >}}) for how dashdash tells
you a new version is out.
