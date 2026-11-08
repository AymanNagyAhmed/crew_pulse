# Vision ↔ api-gateway contract (stubs)

Base URL: `VISION_ENGINE_URL` (default `http://localhost:8000`).  
Peak-load check-ins: **api-gateway** accepts `POST /v1/attendance/check-ins` (202 + job id) and enqueues BullMQ `attendance-check-in`; **worker-node** calls this vision contract, then persists. Do not run detect/match on the gateway request path.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness (model load) |
| `POST` | `/v1/detect` | Face box + quality + **embedding length only**; `reject_reasons` when gates fail |
| `POST` | `/v1/match` | Roster-scoped 1:N; returns `worker_id` + scores; propagates `reject_reasons` |

## Rules for the gateway client

- Send `image_base64` (JSON). Multipart can be added later without dropping this shape.
- For match, always pass `venue_id` + `shift_id`; prefer `candidate_worker_ids` once the shift roster is known (cuts N and false matches).
- Treat `decision` as advisory input to attendance policy (`matched` / `no_match` / `needs_review`), not a final payroll write.
- **Never** expect or log raw embedding vectors from these responses (`embedding_dim` / scores only).
- `stub: false` when RetinaFace/Facenet512 is live; `VISION_STUB=true` forces stubs. Do not special-case beyond metrics.
- Quality gates (`face_too_dark`, `face_too_bright`, `face_too_blurry`, `face_too_small`) reject **before embed**. Coach from `reject_reasons`; do not force match. Station lighting: `infrastructure/docs/station-lighting-sop.md`.
- PAD (passive) runs after quality and **before embed**. Codes: `pad_print`, `pad_replay`, `pad_fail`. Match stays `no_match` when PAD rejects (payroll fail-closed). Accepted faces may include `pad_score` (0 spoof → 1 live); gateways should not treat the raw score as a client-facing liveness verdict beyond the reject codes.

OpenAPI: `{VISION_ENGINE_URL}/docs` or `/openapi.json` (`operationId`s `vision.detect`, `vision.match`).
