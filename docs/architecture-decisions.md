# Challenge → design ownership

Maps `docs/challenges/` to the component that owns the primary mitigation. Details stay in each challenge file.

| # | Challenge | Owner | Design note |
|---|-----------|--------|-------------|
| 1 | High-throughput shift spikes | `api-gateway` + `worker-node` | Accept fast, queue embedding/match/persist; scale vision workers independently |
| 2 | Low light / harsh illumination | `vision-engine` + deploy guide | Quality gates (luminance); reject bad frames; site lighting SOP |
| 3 | Presentation attacks / liveness | `vision-engine` | PAD stage before match; passive multi-frame; active only for high-risk |
| 4 | Scaling vector search | Postgres/pgvector + `api-gateway` | HNSW; scope 1:N to venue/shift roster; online embedding upserts |
| 5 | PPE / masks / occlusion | `vision-engine` | Occlusion-aware models or assisted fallback; PPE enroll variants |
| 6 | Pose / capture quality | Edge client + `vision-engine` | On-device framing QA; multi-template enrollment |
| 7 | Biometric privacy / compliance | `api-gateway` + infra | Encrypted templates; no vector logs; retention/erasure; non-biometric fallback |
| 8 | Demographic bias / fairness | `vision-engine` + release gates | Group-wise FMR/FNMR; capture mitigations for FNMR |
| 9 | Async pipelines / latency | `worker-node` + Redis/BullMQ | SLOs, backpressure, idempotent jobs, raw vs verified history |
| 10 | Multi-venue connectivity / edge | Edge compose + `api-gateway` edge sync | Local vision match; roster cache; server-authority punch sync |
| 11 | Attendance integrity / duplicates | `worker-node` + attendance module | Cooldown, idempotency keys, station binding, audit overrides |
| 12 | Digital injection / deepfakes | Ops policy + mobile SDK | Prefer locked kiosks; attest camera path for BYOD |

Kafka KRaft is deferred until BullMQ+Redis is insufficient (see `docs/main_plan.md` deferred list).
