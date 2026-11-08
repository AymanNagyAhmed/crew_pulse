# CrewPulse build plan

Canonical implementation plan. Challenges: `docs/challenges/` → cover via `docs/plan_to_cover_challenges.md`. Architecture: README + `.cursor/rules/crewpulse-architecture.mdc`.

After each numbered step’s **Done when** passes: branch → commit → push → PR into `dev` (`.cursor/rules/main-plan-step-pr-workflow.mdc`).

## Progress checklist

- [x] **0** Foundations (layout, gitignore, env, Makefile)
- [x] **1** Infrastructure (Compose: Postgres+pgvector, Redis; Nginx stub; migrations home)
- [x] **2** api-gateway skeleton (NestJS, `v1` prefix, health, response envelope)
- [x] **3** vision-engine skeleton (FastAPI, health, detect/embed stub)
- [x] **4** worker-node skeleton (NestJS/BullMQ consumer, health)
- [x] **5** Launch the app / local run (compose up + all health checks documented) — **required before any challenge**
- [ ] **6** Frontend app (`frontend_crew_pulse/`: React + TypeScript, UI skills)
- [ ] **7** Cover challenges (`docs/plan_to_cover_challenges.md`; one branch/PR per challenge onto `dev`)

Stop adding the “Next step” reply footer after phase **5** “Done when” passes. Do not start phase **7** (challenges) until **5** is ticked; prefer finishing phase **6** frontend skeleton before challenge UI work.

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
export FRONTEND=$ROOT/frontend_crew_pulse
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

## Phase 6 — Frontend (`frontend_crew_pulse/`)

React + TypeScript SPA at repo-root `frontend_crew_pulse/` (not under `services/`). Talks to api-gateway only; never imports vision/OpenCV or Nest server code.

UI guidance: project skill `.cursor/skills/frontend-ui-design/`, rule `.cursor/rules/frontend-react.mdc`, and (optional) Cursor Marketplace plugins listed in 6.1.

**Substep progress:** 6.1 done → **next 6.2** → 6.3. Tick phase **6** only after 6.3 Done when.

### 6.1 Cursor UI skills, rules, and editor plugins

Ensure agents and the IDE are set up for intentional frontend design before scaffolding UI screens:

1. Project skill `frontend-ui-design` and rule `frontend-react` are present under `.cursor/` (commit with this phase).
2. Local Cursor plugin `crewpulse-frontend-ui` under `~/.cursor/plugins/local/` (reload window if needed).
3. Editor extensions (WSL): ESLint, Prettier, Tailwind CSS IntelliSense, Auto Rename Tag, Path Intellisense, Error Lens.
4. **Manual (Marketplace):** open Cursor **Customize → Plugins** and install useful UI plugins such as [shadcn/ui](https://cursor.com/marketplace/shadcn) if you plan to use that component system; optional community UI skills from [cursor.directory](https://cursor.directory/).

**Done when:** skill + rule exist in the repo; listed editor extensions are installed (`cursor --list-extensions`); Marketplace plugin installs noted for the developer (shadcn optional).

**Status (2026-11-08):** Done when met — skill/rule committed on `dev` (`docs: add frontend skills`); editor extensions installed; local plugin `~/.cursor/plugins/local/crewpulse-frontend-ui/` present. Optional Marketplace shadcn still manual.

### 6.2 Scaffold React + TypeScript app

Scaffold with Vite (React + TypeScript template) into `frontend_crew_pulse/` using **latest stable** packages only (`npm view react version` → currently track `dist-tags.latest`, e.g. React 19.x). Node 24.22.2. Follow `dependency-check.mdc`.

```zsh
source ~/.nvm/nvm.sh && nvm use 24.22.2
cd ~/ai_projects/crew_pulse
# verify: npm view react version   # must be dist-tags.latest, not canary
npm create vite@latest frontend_crew_pulse -- --template react-ts
cd frontend_crew_pulse && npm install
```

Add `.env.example` with `VITE_API_BASE_URL=http://127.0.0.1:3000`, strict TS, and a minimal home route that names **CrewPulse** (brand-first; apply `frontend-ui-design`).

**Done when:** `npm run build` succeeds; `npm run dev` serves the app; folder is `frontend_crew_pulse/` at repo root.

### 6.3 Wire smoke + README

Document in root README (or `frontend_crew_pulse/README.md`): `make up` for API, then `cd frontend_crew_pulse && npm run dev`. Optional: Makefile `frontend-dev` target. One stub call to gateway health from the UI or a documented `curl` remains acceptable until real screens land.

**Done when:** another engineer can open the SPA against a running stack; phase **6** checklist ticked.

---

## Phase 7 — Cover challenges

Implement mitigations one challenge at a time per `docs/plan_to_cover_challenges.md`. After each challenge: branch named after the challenge file stem, commit, push, PR into `dev` (see `.cursor/rules/challenge-pr-workflow.mdc`).

**Done when:** all C1–C12 checkboxes in `docs/plan_to_cover_challenges.md` are ticked and merged to `dev`.

---

## Deferred (after local run; tracked in challenge plan)

- Kafka KRaft (if BullMQ insufficient for multi-venue fan-out) — may land under C1/C9/C10
- Challenge mitigations C1–C12: `docs/plan_to_cover_challenges.md` (PR workflow: `.cursor/rules/challenge-pr-workflow.mdc`)
- Postman collection sync (`postman-sync.mdc`) once real attendance routes ship
- Nginx TLS and production digests
- Frontend Compose image / Nginx static serving (after 6.x)

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
