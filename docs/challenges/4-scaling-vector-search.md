# Scaling vector search for large crews (1:N matching)

**Domain:** Data / ANN indexing  
**CrewPulse relevance:** Check-in is typically **1:N identification** against an enrolled gallery that grows with agencies, multi-venue crews, and seasonal staff.

## The challenge

Each probe produces a high-dimensional embedding that must be compared against thousands–hundreds of thousands of templates under tight latency. Exact search does not scale; approximate nearest neighbor (ANN) indexes trade recall for speed.

Production lessons from attendance / face-auth platforms:

- Offline libraries (e.g. classic FAISS file indexes) struggle with **live embedding updates** (new hires, re-enrollment) without costly full rebuilds and downtime.
- Persistent vector stores (Milvus, pgvector, etc.) are preferred for online search + incremental upserts.
- Benchmarks with FaceNet-class embeddings on PostgreSQL/pgvector report HNSW search **&lt; ~5 ms** with strong recall up to ~100k identities in controlled tests—but real multi-tenant, filtered (venue/shift) queries change the picture.
- Accuracy metrics that look good as closed-set identification can hide weak **verification** (FAR/FRR/EER); 1:N false accepts grow with gallery size and demographic clustering.

## Why venues make it worse

- Galleries are **dynamic**: day laborers, agency floats, last-minute replacements.
- Queries need **filters** (active shift at this venue) without scanning the global index naively.
- Peak QPS coincides with shift spikes (see challenge 1), so p99 ANN latency matters as much as mean.

## Implications for CrewPulse

- Prefer PostgreSQL + vector extension early if ops simplicity wins; plan a migration path to a dedicated ANN service when gallery/QPS outgrow it.
- Index design: HNSW (or equivalent) with measured recall@k at target FMR; never ship unmeasured IVFFlat defaults.
- Scope search to **eligible workers** (venue + shift roster) to cut effective N and false-match risk.
- Support online upsert/delete of embeddings without full reindex; version templates after model upgrades.
- Separate identification accuracy from verification/security metrics in eval harnesses.

## Sources (2025–2026)

- ZepIris / Zepto attendance: FAISS rebuild pain → Milvus for live updates and scale.
- Yudistira et al., JIKO: MTCNN–FaceNet + pgvector scalability (Exact / IVFFlat / HNSW).
- On-prem attendance case studies using pgvector for mid-size crews.
- NIST notes on 1:N demographic magnification vs 1:1.
