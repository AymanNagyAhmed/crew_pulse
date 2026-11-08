# Vector gallery (C4) — HNSW + roster-scoped 1:N

CrewPulse stores face templates in Postgres/pgvector and searches only workers on the **venue/shift roster**. Online upserts update the HNSW graph without a full reindex.

## Schema

| Object | Role |
|--------|------|
| `crewpulse.workers` / `venues` / `shifts` | Minimal identity keys for FKs |
| `crewpulse.shift_roster` | Eligible workers for a venue + shift |
| `crewpulse.face_templates` | AES-GCM `embedding_ciphertext` + `encryption_kid` + model/template versions |
| Search index | Roster decrypt + cosine in api-gateway (`encrypted_roster`; see C7) |

Migrations: `002_vector_gallery.sql` (schema) then `003_biometric_privacy.sql` (ciphertext cutover). Fresh Compose volumes apply `001`–`003` via `docker-entrypoint-initdb.d`. Existing volumes:

```zsh
make migrate
```

## Online upsert (enroll / re-enroll)

Trusted service path (not for browsers; do not echo embeddings in responses or logs):

1. Prefer **multi-template** enroll with capture QA: `POST /v1/gallery/enroll` (several frontal frames / PPE variants). See `services/vision-engine/docs/edge-capture-contract.md`.
2. Or single upsert: `PUT /v1/gallery/templates` with `workerId`, `modelVersion`, `embedding` (length 512), optional `templateVersion`.
3. Gateway L2-normalizes, AES-GCM-encrypts with `BIOMETRIC_TEMPLATE_KEY`, then upserts ciphertext on `(worker_id, model_version, template_version)`.
4. List variants: `GET /v1/gallery/workers/{workerId}/templates` (metadata only).
5. Add the worker to the active roster: `PUT /v1/gallery/roster` with `venueId`, `shiftId`, `workerId`.

Roster changes (agency float, last-minute replacement) only touch `shift_roster` — no gallery rebuild.

## Roster-scoped search

`POST /v1/gallery/search` with probe `embedding`, `venueId`, `shiftId`, optional `topK` / `modelVersion`:

- Joins encrypted `face_templates` → `shift_roster` for that venue/shift.
- Decrypts roster templates in process and ranks by cosine similarity.
- Returns `workerId` + similarity scores only (never the vector); `index: "encrypted_roster"`.

Workers enrolled in the global gallery but **not** on the shift roster are excluded. Erased workers (`biometrics_erased_at`) are excluded.

## Ops notes

- Keep shift rosters tight — search cost scales with roster × templates.
- Bump `model_version` after embedding-model upgrades; keep old templates until cutover.
- Privacy details, erase/retention, and frame scrubbing: `infrastructure/docs/biometric-privacy.md`.
