# Asynchronous pipelines and end-to-end latency

**Domain:** Architecture / SRE  
**CrewPulse relevance:** CrewPulse’s README promises an event-driven pipeline for peak queues—latency and consistency semantics must be designed, not assumed.

## The challenge

Moving to Kafka/BullMQ/Redis solves overload but introduces new failure modes:

- **Tail latency:** queue wait + embedding + ANN + DB commit can exceed “real-time” UX even when means look fine.
- **Backpressure:** unbounded queues hide outages until attendance is minutes late.
- **Exactly-once vs at-least-once:** duplicate job delivery can double-punch attendance without idempotency keys.
- **Partial failure:** vision succeeded, write failed (or vice versa) → audit gaps.
- External or GPU inference rate limits (HTTP 429) require circuit breakers; naive retries stampede the dependency.

InfoQ and 2025 microservice attendance systems stress: treat face verification as a distributed system with load leveling, not a single REST call.

## Why venues make it worse

- Users judge “real-time” by door experience, not p50 of a worker pod.
- Multi-venue fan-out multiplies consumers and lag variance.
- Offline periods (challenge 10) force local queues that must later merge safely.

## Implications for CrewPulse

- Define SLOs: e.g. p95 match decision &lt; X ms on-site; degrade gracefully with clear UI states (`queued`, `matched`, `needs_review`).
- Idempotency on attendance writes (`Idempotency-Key` / device event id).
- Separate raw capture history from verified attendance records for traceability (pattern used in 2025 attendance microservices).
- Observability: queue depth, inference saturation, ANN p99, PAD reject rates—alert before shift start.

## Sources (2025–2026)

- InfoQ: async queues, 202 Accepted + poll/WebSocket, circuit breakers, independent scaling.
- JEEICT 2025 face-attendance microservices: cooldown, history vs history_ai separation; future work on spike latency.
