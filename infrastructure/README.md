# Infrastructure

Local Docker Compose stack for CrewPulse.

Default host binds (to avoid clashing with other WSL stacks): Postgres `127.0.0.1:15434`, Redis `127.0.0.1:16379`, api-gateway `127.0.0.1:3000`, vision-engine `127.0.0.1:8000`, worker-node `127.0.0.1:3001`, Nginx (profile `edge`) `127.0.0.1:8080`.

## Images (pinned)

| Service | Image | Digest (local pin reference) |
|---------|--------|------------------------------|
| Postgres + pgvector | `pgvector/pgvector:0.8.7-pg17` | `sha256:7d0a41464797aeb9862dfdc0bbf1526b82cfd324cdd8036df19e3545f4a9ccb8` |
| Redis | `redis:8.2.11-alpine` | `sha256:489a769e0a54dc245896132a15c72d2bc7296719954da99398f43a3877e5f8eb` |
| Nginx | `nginx:1.28.0-alpine` | `sha256:30f1c0d78e0ad60901648be663a710bdadf19e4c10ac6782c235200619158284` |
| Node base (api-gateway, worker-node) | `node:24.22.2-bookworm-slim` | `sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9` |
| Python base (vision-engine) | `python:3.12.16-slim-bookworm` | `sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df` |

App images are built locally: `crewpulse/api-gateway:local`, `crewpulse/vision-engine:local`, `crewpulse/worker-node:local`.

Re-verify digests after `docker pull` before production compose. Trivy on the Node official base may report HIGH findings in bundled `undici` / `brace-expansion`; track upstream Node image updates.

## Quick start

End-to-end smoke (health + stub check-in curls) is documented in the [root README — Local smoke path](../README.md#local-smoke-path). Short form:

```zsh
cd ~/ai_projects/crew_pulse
cp infrastructure/env/.env.example infrastructure/env/.env   # or: make env
make up          # builds + starts postgres, redis, api-gateway, vision-engine, worker-node
make health      # infra + three service health endpoints
make smoke       # health + vision /v1/match stub + gateway /v1/attendance
docker compose --env-file infrastructure/env/.env -f infrastructure/compose/docker-compose.yml ps
```

Fresh Postgres runs `migrations/001_init.sql` then `002_vector_gallery.sql` (vector extension, `crewpulse` schema, face templates + HNSW, shift roster). Existing volumes: `make migrate`. Gallery upsert/search: `infrastructure/docs/vector-gallery.md`.

Compose injects service DNS (`postgres`, `redis`, `vision-engine`) into container env. The localhost URLs in `.env` remain for host-side `npm` / `uvicorn` runs.

### Station lighting (C2)

Deploy capture stations per [`docs/station-lighting-sop.md`](docs/station-lighting-sop.md). Vision rejects `face_too_dark` / `face_too_bright` (and blur/size) **before embed**; tune `FACE_MIN_LUMINANCE`, `FACE_MAX_LUMINANCE`, `FACE_MAX_BLUR`, `FACE_MIN_SIZE_PX`.

### Vision models

`VISION_STUB=true` (default) boots without DeepFace weights. For real detection:

1. Set `VISION_STUB=false` in `infrastructure/env/.env`
2. Ensure weights under a DeepFace home (`DEEPFACE_HOME` → `<home>/.deepface/weights`)
3. Rebuild/recreate: `make up`

Nginx is under Compose profile `edge`:

```zsh
docker compose --env-file infrastructure/env/.env -f infrastructure/compose/docker-compose.yml --profile edge up -d
# /v1/ → api-gateway, /vision/ → vision-engine on 127.0.0.1:8080
```

## Layout

- `compose/docker-compose.yml` — postgres, redis, three app services, optional nginx
- `migrations/` — SQL init / future migrations
- `nginx/` — reverse-proxy (`edge` profile)
- `env/.env.example` — template; real `.env` is gitignored
- `docs/station-lighting-sop.md` — capture-station lighting + quality-gate coaching
