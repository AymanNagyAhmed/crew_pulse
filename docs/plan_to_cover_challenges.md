# Plan to cover challenges

Canonical challenge implementation plan. Source briefs: `docs/challenges/`. Ownership: `docs/architecture-decisions.md`. Skeleton build: `docs/main_plan.md`.

## Prerequisite (hard gate)

Do **not** start any challenge step until `docs/main_plan.md` phase **5** (Local run / launch the app) is done:

- `make up` starts infra + api-gateway + vision-engine + worker-node
- Health checks for gateway, vision, and worker succeed
- Progress checklist item **5** is ticked

Git workflow for every challenge: `.cursor/rules/challenge-pr-workflow.mdc` (branch named after the challenge file → commit → push → PR into `dev`).

---

## Progress checklist

- [x] **C1** `1-high-throughput-shift-spikes` — queue & decouple under shift spikes
- [x] **C2** `2-low-light-and-harsh-illumination` — luminance / quality gates + deploy lighting SOP
- [x] **C3** `3-presentation-attacks-and-liveness` — PAD / liveness before match
- [x] **C4** `4-scaling-vector-search` — pgvector HNSW + venue/shift-scoped 1:N
- [x] **C5** `5-ppe-masks-and-occlusion` — occlusion-aware match + assisted fallback
- [x] **C6** `6-pose-angle-and-capture-quality` — capture QA + multi-template enrollment
- [x] **C7** `7-biometric-privacy-and-compliance` — encrypted templates, retention, no vector logs
- [ ] **C8** `8-demographic-bias-and-fairness` — group-wise metrics + release gates
- [ ] **C9** `9-async-pipelines-and-end-to-end-latency` — SLOs, backpressure, idempotent jobs
- [ ] **C10** `10-multi-venue-connectivity-and-edge` — offline / edge roster + sync
- [ ] **C11** `11-attendance-integrity-and-duplicates` — cooldown, idempotency, audit overrides
- [ ] **C12** `12-digital-injection-and-deepfakes` — managed stations + mobile attestation policy

---

## C1 — `1-high-throughput-shift-spikes`

**Owner:** `api-gateway` + `worker-node`  
**Cover by:** Accept check-in frames with a fast ack; push detect/embed/match/persist onto BullMQ (Redis); scale vision workers independently of HTTP; client quality gates before upload. No synchronous full pipeline on the request path.

**Done when:** Peak-load path returns 202 (or equivalent) with job id; worker completes match; targeted load or concurrency test shows gateway stays responsive while inference queues.

**Status (2026-11-08):** `POST /v1/attendance/check-ins` → 202 + job id on BullMQ `attendance-check-in`; worker calls vision `/v1/match` then persists; gateway concurrency e2e + worker match e2e pass.

---

## C2 — `2-low-light-and-harsh-illumination`

**Owner:** `vision-engine` + deploy guide  
**Cover by:** Reject frames below luminance / face-quality thresholds with a coachable error; document station lighting SOP in `infrastructure/` or README deploy notes; keep bad frames out of match.

**Done when:** Fixture dark/overexposed images are rejected before embed; SOP doc exists; unit/integration tests cover quality gate outcomes.

**Status (2026-11-08):** Dark/bright fixtures + `reject_reasons` on detect/match; embed skipped on gate fail; `infrastructure/docs/station-lighting-sop.md`; `tests/test_quality.py`.

---

## C3 — `3-presentation-attacks-and-liveness`

**Owner:** `vision-engine`  
**Cover by:** Add a PAD stage before match (passive multi-frame first; active only for high-risk / mobile); fail closed on PAD fail for payroll-grade punches.

**Done when:** Stub or real PAD score appears in the vision pipeline; print/replay fixtures fail PAD; match is skipped when PAD rejects.

**Status (2026-11-08):** Passive PAD after quality / before embed; `pad_score` on accepted faces; `pad_print` / `pad_replay` fixtures + `tests/test_pad.py`; match fail-closed via `reject_reasons`.

---

## C4 — `4-scaling-vector-search`

**Owner:** Postgres/pgvector + `api-gateway`  
**Cover by:** HNSW (or equivalent) indexes; scope 1:N search to venue/shift roster; online embedding upserts for enroll/roster changes.

**Done when:** Migration + query path uses vector index; search is roster-scoped; upsert path documented and tested for a small gallery.

**Status (2026-11-08):** `002_vector_gallery.sql` + HNSW; `PUT /v1/gallery/templates`, `PUT /v1/gallery/roster`, `POST /v1/gallery/search`; `infrastructure/docs/vector-gallery.md`; gallery unit + e2e on small roster.

---

## C5 — `5-ppe-masks-and-occlusion`

**Owner:** `vision-engine`  
**Cover by:** Detect heavy occlusion; prefer occlusion-aware models or PPE-on/PPE-off enrollment variants; route hard occlusion to assisted fallback (supervisor PIN / QR), not silent false reject.

**Done when:** Occlusion signal in detect response; fallback path wired in api-gateway attendance flow; tests with masked/occluded fixtures.

**Status (2026-11-08):** Occlusion gate + `occlusion_score` / `face_occluded`; match `assisted_fallback`; `POST /v1/attendance/assisted-check-ins` (PIN/QR); `infrastructure/docs/ppe-occlusion-sop.md`; masked fixture + tests.

---

## C6 — `6-pose-angle-and-capture-quality`

**Owner:** Edge client contract + `vision-engine`  
**Cover by:** Enforce face size, blur, yaw/pitch bounds before match; multi-template enrollment QA; API errors that the client can show as framing feedback.

**Done when:** Bad pose/blur fixtures rejected; enrollment accepts multiple templates per worker; contract documented for edge clients.

**Status (2026-11-08):** Yaw/pitch gates + blur/yaw fixtures; `POST /v1/gallery/enroll` multi-template with capture QA; `docs/edge-capture-contract.md`.

---

## C7 — `7-biometric-privacy-and-compliance`

**Owner:** `api-gateway` + infra  
**Cover by:** Encrypt templates at rest; never log full vectors; short-lived in-flight frame handling; retention/erasure hooks; usable non-biometric fallback (badge/PIN).

**Done when:** No embedding in logs/responses unless explicitly contracted; retention job or documented erase API; fallback punch path exists.

**Status (2026-11-08):** AES-GCM `embedding_ciphertext` (`003_biometric_privacy.sql`); roster decrypt search; erase + retention purge APIs; BullMQ frame age/scrub; assisted `badge` method; `infrastructure/docs/biometric-privacy.md`.

---

## C8 — `8-demographic-bias-and-fairness`

**Owner:** `vision-engine` + release gates  
**Cover by:** Capture/threshold mitigations for FNMR; document group-wise FMR/FNMR eval harness (lawful metrics only); fairness checks as a release gate in this plan / CI notes.

**Done when:** Eval harness or documented procedure exists; threshold/capture mitigations linked; release checklist mentions fairness gate.

---

## C9 — `9-async-pipelines-and-end-to-end-latency`

**Owner:** `worker-node` + Redis/BullMQ  
**Cover by:** Define SLOs (e.g. p95 decision); queue depth / backpressure; idempotent jobs; separate raw capture history from verified attendance; circuit breakers on vision HTTP.

**Done when:** Job states (`queued` / `matched` / `needs_review`) exposed; duplicate delivery does not double-write; basic queue metrics or docs for alerting before shift start.

---

## C10 — `10-multi-venue-connectivity-and-edge`

**Owner:** Edge Compose profile (deferred until cloud path is solid)  
**Cover by:** Local roster embedding cache + outbound attendance queue; sync rules (server authority for payroll); optional on-prem `vision-engine` profile; uplink crops/embeddings not raw 4K.

**Done when:** Compose `edge` (or similar) profile boots local match path; offline punch syncs without duplicate payroll rows; sync/conflict rules documented.

---

## C11 — `11-attendance-integrity-and-duplicates`

**Owner:** `worker-node` + attendance module  
**Cover by:** Idempotency keys `(workerId, venueId, shiftId, direction, timeBucket)`; per-venue cooldown; station/geofence binding; immutable audit of overrides and low-confidence accepts.

**Done when:** Duplicate punches suppressed; override API writes audit only; unit/e2e cover cooldown + idempotency.

---

## C12 — `12-digital-injection-and-deepfakes`

**Owner:** Ops policy + mobile/station policy (api-gateway risk flags)  
**Cover by:** Prefer managed kiosks (no virtual-camera drivers) for payroll-grade punches; mark BYOD/remote selfie as high risk (step-up, geo, active liveness, human review); device/pipeline anomaly hooks where feasible.

**Done when:** Station vs mobile risk policy encoded (config + docs); high-risk path requires step-up or review; managed-station deploy notes exist.

---

## After each challenge

1. Tick the matching checkbox above when **Done when** passes.
2. Follow `challenge-pr-workflow.mdc`: branch = challenge file stem, PR base = `dev`.
3. Update `docs/architecture-decisions.md` only if ownership or design note changed.
