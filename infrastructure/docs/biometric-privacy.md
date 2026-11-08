# Biometric privacy & compliance (C7)

Face templates are special-category biometric data. CrewPulse encrypts them at rest, never returns or logs full vectors, keeps in-flight frames short-lived, exposes erase/retention hooks, and offers a usable non-biometric punch path.

## At-rest encryption

| Piece | Behavior |
|-------|----------|
| Column | `crewpulse.face_templates.embedding_ciphertext` (`bytea`) |
| Algorithm | AES-256-GCM (`iv \|\| ciphertext \|\| tag`) |
| Key | `BIOMETRIC_TEMPLATE_KEY` (base64, 32 bytes) + `encryption_kid` (`v1`) |
| Search | Roster-scoped decrypt in api-gateway + cosine in process (`index: encrypted_roster`) |

Plaintext `vector(512)` + HNSW from C4 are removed by `003_biometric_privacy.sql` — ciphertext cannot be ANN-indexed. Shift rosters stay small enough for decrypt-and-rank.

Generate a real key (never commit production keys):

```zsh
openssl rand -base64 32
```

## No vector leakage

- Upsert / enroll / search / list responses expose ids, dims, scores, and `encryptionKid` only — never embedding arrays.
- Do not log request bodies that contain `embedding` or `imageBase64`.
- Job status APIs return match metadata only.

## Short-lived in-flight frames

1. Check-in enqueue stores `imageBase64` on the BullMQ job for the worker only.
2. Worker scrub: after the vision call, `imageBase64` is cleared on the job payload.
3. Gateway `removeOnComplete` / `removeOnFail` use age caps (~2–5 minutes) so Redis is not a face archive.
4. No durable raw-image gallery; enroll accepts embeddings from a trusted path, not long-lived JPEGs in Postgres.

## Retention & erasure

| API | Role |
|-----|------|
| `DELETE /v1/gallery/workers/:workerId/biometrics` | Hard-delete templates (+ roster by default); write `biometric_erasure_audit` |
| `PUT /v1/gallery/workers/:workerId/retention` | Set `biometric_retention_until` (purpose / employment end) |
| `POST /v1/gallery/retention/purge` | Erase workers whose retention instant has elapsed |

Cron / ops can call purge on a schedule (`requestedBy: retention-cron`). Backups and vendor copies remain an org process outside this API.

## Non-biometric fallback

Workers must have a practical alternative to face punch:

- `POST /v1/attendance/assisted-check-ins` with `method`: `supervisor_pin` \| `qr` \| `badge`
- Env: `ASSISTED_SUPERVISOR_PIN`, `ASSISTED_QR_TOKENS`, `ASSISTED_BADGE_TOKENS`

Use badge/PIN for privacy opt-out and for PPE `assisted_fallback` (see `ppe-occlusion-sop.md`) — not as a punitive path.

## Migration

```zsh
make migrate   # applies 001–003 including 003_biometric_privacy.sql
```

Fresh Compose volumes mount `003` via `docker-entrypoint-initdb.d`. After cutover, **re-enroll** templates (pre-C7 plaintext rows are deleted).
