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

## Configuration files

dashdash needs at least two config files to start: `settings.yml` and
`services.yml`. Annotated examples ship in the `config/` folder of the
repository — copy them in before the first start:

```bash
mkdir -p config data
cp config/settings.yml.example config/settings.yml
cp config/services.yml.example config/services.yml
```

You can leave `integrations.yml` out for now; it's only needed if you wire up
named API integrations later. See [Configuration files]({{< relref "/configuration/files/" >}})
for what each file controls.

## First start

```bash
docker compose up -d
```

Open `http://localhost:3000`. You'll land on a login screen with a
**Register** link — dashdash starts with no accounts at all.

Register the first account. It automatically becomes the **admin** account,
regardless of how you signed up (local password or SSO, if you've configured
it). Every account after that starts as a regular user; an admin can promote
others later from the admin panel.

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
