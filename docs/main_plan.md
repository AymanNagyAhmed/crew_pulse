# CrewPulse build plan

Canonical implementation plan. Challenges: `docs/challenges/` → cover via `docs/plan_to_cover_challenges.md`. Architecture: README + `.cursor/rules/crewpulse-architecture.mdc`.

After each numbered step’s **Done when** passes: branch → commit → push → PR into `dev` (`.cursor/rules/main-plan-step-pr-workflow.mdc`).

## Progress checklist

- [x] **0** Foundations (layout, gitignore, env, Makefile)
- [x] **1** Infrastructure (Compose: Postgres+pgvector, Redis; Nginx stub; migrations home)
- [x] **2** api-gateway skeleton (NestJS, `v1` prefix, health, response envelope)
- [ ] **3** vision-engine skeleton (FastAPI, health, detect/embed stub)
- [ ] **4** worker-node skeleton (NestJS/BullMQ consumer, health)
- [ ] **5** Launch the app / local run (compose up + all health checks documented) — **required before any challenge**
- [ ] **6** Cover challenges (`docs/plan_to_cover_challenges.md`; one branch/PR per challenge onto `dev`)

Stop adding the “Next step” reply footer after phase **5** “Done when” passes. Do not start phase **6** until **5** is ticked.

---

## Shell setup (every session)

```zsh
cd ~/ai_projects/crew_pulse
source ~/.nvm/nvm.sh && nvm use 24.22.2
export ROOT=~/ai_projects/crew_pulse
export API=$ROOT/services/api-gateway
export VISION=$ROOT/services/vision-engine
export WORKER=$ROOT/services/worker-node
export INFRA=$ROOT/infrastructure
```

---

## Phase 0 — Foundations

### 0.1 Create repository layout and ignore rules

Create empty service/infra trees and a root `.gitignore` suitable for Node, Python, Docker, models, and secrets.

```zsh
mkdir -p services/api-gateway services/vision-engine services/worker-node \
  infrastructure/{compose,migrations,nginx,env} docs
```

**Done when:** directories exist; `.gitignore` excludes `node_modules/`, `.env`, `__pycache__/`, `.venv/`, model weight caches, `dist/`, coverage, OS junk.

### 0.2 Root env template and Makefile

Add `infrastructure/env/.env.example` (copied to `.env` locally, never committed) and a root `Makefile` with `up`, `down`, `logs`, `dev` targets (stubs OK until Compose exists).

**Done when:** `.env.example` lists Postgres, Redis, service ports, and placeholder secrets; `make up` / `make down` are defined (may no-op until phase 1).

### 0.3 Challenge → design notes link

Add `docs/architecture-decisions.md` with a short table mapping each `docs/challenges/*.md` to the service/component that owns the mitigation (no essays).

**Done when:** file exists; all 12 challenges appear in the table.

---

## Phase 1 — Infrastructure

### 1.1 Pin base images and Compose stack

Under `infrastructure/compose/`, define `docker-compose.yml` for:

- PostgreSQL with **pgvector**
- Redis
- (Optional later) Kafka KRaft — defer until worker needs it; BullMQ+Redis first

Pin version tags (never `latest`); follow `dependency-check.mdc` before pull.

**Done when:** `docker compose -f infrastructure/compose/docker-compose.yml config` succeeds; `postgres` and `redis` healthy via `make up`; `make health` reports both ok.

### 1.2 Database bootstrap

SQL init or migration folder under `infrastructure/migrations/` for extensions (`vector`) and empty schema placeholder.

**Done when:** fresh volume starts with `CREATE EXTENSION vector` applied; documented in README or `infrastructure/README.md`.

### 1.3 Nginx stub

Minimal `infrastructure/nginx/` reverse-proxy config routing `/v1/` → api-gateway (wire hosts after services exist).

**Done when:** config file present and validated with `nginx -t` in the nginx image (or documented as phase-5 wire-up).

---

## Phase 2 — api-gateway (NestJS)

### 2.1 Scaffold NestJS app

Scaffold in `services/api-gateway` with Nest CLI (Node 24.22.2). TypeScript strict. Scripts: `build`, `start:dev`, `test`.

**Done when:** `npm run build` succeeds; app boots locally.

### 2.2 Global `v1` prefix + health

`GET /v1/health` → envelope success; global `ResponseInterceptor` + `AllExceptionsFilter` per `nestjs-api-response.mdc`.

**Done when:** curl health returns `{ "success": true, ... }`; unhandled errors use failure envelope.

### 2.3 Config module

`@nestjs/config` + validation for `DATABASE_URL`, `REDIS_URL`, `VISION_ENGINE_URL`, ports. No hardcoded secrets.

**Done when:** boot fails fast on missing required env in non-test.

### 2.4 Domain stubs (modules only)

Empty feature modules: `workers`, `venues`, `shifts`, `attendance` (controllers return 501 or empty lists). File layout per `nestjs-file-structure.mdc`.

**Done when:** modules registered; OpenAPI/`operationId`s present for health at minimum.

---

## Phase 3 — vision-engine (FastAPI)

### 3.1 Scaffold FastAPI layout

Layout per `fastapi-vision-structure.mdc`; pinned `requirements.txt` (FastAPI, Uvicorn, pydantic-settings; OpenCV/DeepFace in a later step).

**Done when:** `uvicorn` serves app; `GET /health` 200.

### 3.2 Embedding/match API stubs

`POST /v1/detect` and `POST /v1/match` with Pydantic schemas returning stub scores (no heavy models yet).

**Done when:** OpenAPI shows routes; contract reviewed against api-gateway client expectations.

### 3.3 Wire real detection (RetinaFace / DeepFace)

Add OpenCV + chosen face stack; quality gates (blur, face size) before embed. **Do not** return raw embeddings to untrusted clients.

**Done when:** fixture image yields a detection box + embedding length; unit test with a sample face image.

---

## Phase 4 — worker-node

### 4.1 Scaffold NestJS worker

BullMQ (or Nest processor) consuming attendance-log and webhook queues from Redis.

**Done when:** process starts, connects to Redis, processes a test job idempotently.

### 4.2 Attendance persistence job

Write verified attendance rows; cooldown / idempotency keys (challenge 11).

**Done when:** duplicate job does not duplicate punch; targeted e2e/unit passes.

---

## Phase 5 — Launch the app / local run integration

### 5.1 Compose service images

Dockerfiles for api-gateway, vision-engine, worker-node; add to Compose with depends_on healthchecks.

**Done when:** `make up` starts infra + three services.

### 5.2 Documented smoke path

README section: `make up`, health curls for gateway + vision, one stub check-in request.

**Done when:** another engineer can follow README and see three healthy services; phase **5** checklist ticked. **Do not begin challenge work until this passes.**

---

## Phase 6 — Cover challenges

Implement mitigations one challenge at a time per `docs/plan_to_cover_challenges.md`. After each challenge: branch named after the challenge file stem, commit, push, PR into `dev` (see `.cursor/rules/challenge-pr-workflow.mdc`).

**Done when:** all C1–C12 checkboxes in `docs/plan_to_cover_challenges.md` are ticked and merged to `dev`.

---

## Deferred (after local run; tracked in challenge plan)

- Kafka KRaft (if BullMQ insufficient for multi-venue fan-out) — may land under C1/C9/C10
- Challenge mitigations C1–C12: `docs/plan_to_cover_challenges.md` (PR workflow: `.cursor/rules/challenge-pr-workflow.mdc`)
- Postman collection sync (`postman-sync.mdc`) once real attendance routes ship
- Nginx TLS and production digests

## Challenge ownership (summary)

| Challenge | Primary owner |
|-----------|----------------|
| 1 Shift spikes | api-gateway + worker-node queues |
| 2 Low light | vision-engine quality gates + deploy guide |
| 3 PAD / spoofing | vision-engine |
| 4 Vector search | Postgres/pgvector + api-gateway |
| 5 PPE / occlusion | vision-engine |
| 6 Pose / capture QA | edge client + vision-engine |
| 7 Privacy | api-gateway + infra retention |
| 8 Demographics | vision-engine eval + thresholds |
| 9 Async latency | worker-node + Redis/BullMQ |
| 10 Edge / offline | later edge profile |
| 11 Duplicates / integrity | worker-node + attendance module |
| 12 Injection / deepfakes | managed stations + mobile policy |
