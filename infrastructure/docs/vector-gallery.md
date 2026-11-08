# Vector gallery (C4) — HNSW + roster-scoped 1:N

CrewPulse stores face templates in Postgres/pgvector and searches only workers on the **venue/shift roster**. Online upserts update the HNSW graph without a full reindex.

## Schema

| Object | Role |
|--------|------|
| `crewpulse.workers` / `venues` / `shifts` | Minimal identity keys for FKs |
| `crewpulse.shift_roster` | Eligible workers for a venue + shift |
| `crewpulse.face_templates` | `vector(512)` templates + `model_version` / `template_version` |
| `face_templates_embedding_hnsw` | HNSW on `embedding` (`vector_cosine_ops`) |

Migration: `infrastructure/migrations/002_vector_gallery.sql`. Fresh Compose volumes apply `001` + `002` via `docker-entrypoint-initdb.d`. Existing volumes:

```zsh
make migrate
```

## Online upsert (enroll / re-enroll)

Trusted service path (not for browsers; do not echo embeddings in responses or logs):

1. Ensure worker/venue/shift rows exist (upsert helpers on the same API).
2. `PUT /v1/gallery/templates` with `workerId`, `modelVersion`, `embedding` (length 512), optional `templateVersion`.
3. Gateway L2-normalizes the vector, then `INSERT … ON CONFLICT DO UPDATE` on `(worker_id, model_version, template_version)`.
4. Add the worker to the active roster: `PUT /v1/gallery/roster` with `venueId`, `shiftId`, `workerId`.

Roster changes (agency float, last-minute replacement) only touch `shift_roster` — no gallery rebuild.

## Roster-scoped search

`POST /v1/gallery/search` with probe `embedding`, `venueId`, `shiftId`, optional `topK` / `modelVersion`:

- Joins `face_templates` → `shift_roster` for that venue/shift.
- Orders by cosine distance (`embedding <=> probe`) so the planner can use HNSW.
- Returns `workerId` + similarity scores only (never the vector).

Workers enrolled in the global gallery but **not** on the shift roster are excluded.

## Ops notes

- Tune `hnsw.ef_search` (session) if recall@k drops under filtered load.
- Bump `model_version` after embedding-model upgrades; keep old templates until cutover.
- Privacy (C7) will encrypt templates at rest; until then treat DB access as sensitive.
