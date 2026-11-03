# Vision ↔ api-gateway contract (stubs)

Base URL: `VISION_ENGINE_URL` (default `http://localhost:8000`).  
Gateway has no HTTP client module yet; this is the contract it should call when attendance orchestration lands.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness (model load) |
| `POST` | `/v1/detect` | Face box + quality + **embedding length only** |
| `POST` | `/v1/match` | Roster-scoped 1:N; returns `worker_id` + scores |

## Rules for the gateway client

- Send `image_base64` (JSON). Multipart can be added later without dropping this shape.
- For match, always pass `venue_id` + `shift_id`; prefer `candidate_worker_ids` once the shift roster is known (cuts N and false matches).
- Treat `decision` as advisory input to attendance policy (`matched` / `no_match` / `needs_review`), not a final payroll write.
- **Never** expect or log raw embedding vectors from these responses (`embedding_dim` / scores only).
- `stub: false` when RetinaFace/Facenet512 is live; `VISION_STUB=true` forces stubs. Do not special-case beyond metrics.

OpenAPI: `{VISION_ENGINE_URL}/docs` or `/openapi.json` (`operationId`s `vision.detect`, `vision.match`).
