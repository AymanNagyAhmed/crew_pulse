# Infrastructure

Local Docker Compose stack for CrewPulse.

Default host binds (to avoid clashing with other WSL stacks): Postgres `127.0.0.1:15434`, Redis `127.0.0.1:16379`, Nginx (profile `edge`) `127.0.0.1:8080`.

## Images (pinned)

| Service | Image | Digest (local pin reference) |
|---------|--------|------------------------------|
| Postgres + pgvector | `pgvector/pgvector:0.8.7-pg17` | `sha256:7d0a41464797aeb9862dfdc0bbf1526b82cfd324cdd8036df19e3545f4a9ccb8` |
| Redis | `redis:8.2.11-alpine` | `sha256:489a769e0a54dc245896132a15c72d2bc7296719954da99398f43a3877e5f8eb` |
| Nginx | `nginx:1.28.0-alpine` | `sha256:30f1c0d78e0ad60901648be663a710bdadf19e4c10ac6782c235200619158284` |

Re-verify digests after `docker pull` before production compose.

## Quick start

```zsh
cd ~/ai_projects/crew_pulse
cp infrastructure/env/.env.example infrastructure/env/.env   # or: make env
make up
make health   # postgres pg_isready + vector extension, redis PONG
docker compose --env-file infrastructure/env/.env -f infrastructure/compose/docker-compose.yml ps
```

Fresh Postgres runs `migrations/001_init.sql` (enables `vector`, creates `crewpulse` schema).

Nginx is under Compose profile `edge` (optional):

```zsh
docker compose --env-file infrastructure/env/.env -f infrastructure/compose/docker-compose.yml --profile edge up -d
```

## Layout

- `compose/docker-compose.yml` — postgres, redis, optional nginx
- `migrations/` — SQL init / future migrations
- `nginx/` — reverse-proxy stub
- `env/.env.example` — template; real `.env` is gitignored
