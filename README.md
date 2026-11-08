# 🚀 CrewPulse

**CrewPulse** is a scalable, low-latency workforce management and biometric tracking platform built specifically for catering companies, event agencies, and hospitality operations. It replaces legacy check-in workflows with real-time computer vision, ensuring seamless multi-venue crew tracking and automated attendance auditing.

---

## ✨ Key Features

- **Contactless Facial Recognition:** High-speed biometric identification optimized for multi-angle and varied lighting conditions at venue entrances.
- **Multi-Venue Shift Sync:** Real-time logging of staff arrivals, departures, and role assignments across concurrent events.
- **Asynchronous Processing Pipeline:** Event-driven architecture handling peak check-in queues without bottlenecks.
- **Audit & Compliance Ready:** Comprehensive logging and secure embedding storage adhering to modern data privacy standards.

---

## 🛠️ Tech Stack

- **Computer Vision & AI:** Python, OpenCV, DeepFace / RetinaFace, NumPy
- **Backend Core:** Node.js / NestJS, TypeScript, Python (FastAPI microservice for vision processing)
- **Data & Message Broker:** PostgreSQL (with vector indexing), Redis, BullMQ / Kafka KRaft
- **Infrastructure & Deployment:** Docker, Docker Compose, Nginx

---

## 📁 Project Architecture

```text
crewpulse/
├── services/
│   ├── api-gateway/       # NestJS core API & business logic
│   ├── vision-engine/     # FastAPI Python service for face detection & embeddings
│   └── worker-node/       # Background job queue processing (attendance logs, webhooks)
├── infrastructure/        # Docker compose, database migrations, and env configs
└── docs/                  # System architecture diagrams and API specs
```

---

## Local smoke path

Prerequisites: Docker (Compose v2+), `curl`, and Node **24.22.2** via nvm only if you run services on the host.

```zsh
cd ~/ai_projects/crew_pulse   # or this repo root
source ~/.nvm/nvm.sh && nvm use 24.22.2   # optional for host-side npm; Compose images pin Node
make env                      # creates infrastructure/env/.env from the example if missing
make up                       # builds + starts postgres, redis, api-gateway, vision-engine, worker-node
make health                   # all five checks must print ok
make smoke                    # health + stub match + attendance list
```

Expected host ports: api-gateway `3000`, vision-engine `8000`, worker-node `3001`, Postgres `15434`, Redis `16379`.

### Health curls

```zsh
curl -s http://127.0.0.1:3000/v1/health
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/ready
curl -s http://127.0.0.1:3001/v1/health
```

Gateway and worker responses use the Nest envelope (`"success": true`). Vision returns `{"status":"ok",...}`.

### Stub check-in (vision match)

Attendance HTTP write is not wired yet. Until then, smoke the check-in path with vision stub match (`VISION_STUB=true` by default in Compose):

```zsh
# 1x1 PNG — stub path does not need a real face
IMG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

curl -s -X POST http://127.0.0.1:8000/v1/match \
  -H 'Content-Type: application/json' \
  -d "{\"image_base64\":\"$IMG\",\"venue_id\":\"ven_smoke\",\"shift_id\":\"shf_smoke\",\"candidate_worker_ids\":[\"wrk_smoke_001\"]}"
```

Expect `"decision":"matched"`, `"stub":true`, and **no** raw embedding vector. Gateway attendance list stub:

```zsh
curl -s http://127.0.0.1:3000/v1/attendance
```

More infra detail (image digests, `VISION_STUB`, nginx `edge` profile): [`infrastructure/README.md`](infrastructure/README.md). Build plan: [`docs/main_plan.md`](docs/main_plan.md).
