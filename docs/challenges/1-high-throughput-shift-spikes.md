# High-throughput shift-start spikes

**Domain:** Operations / distributed systems  
**CrewPulse relevance:** Catering and event venues flood entrances at shift start; dozens to hundreds of workers check in within a few minutes.

## The challenge

Face recognition attendance is not a steady-state workload. Peak demand arrives as a **thundering herd**: many cameras or devices submit frames at once. Synchronous “detect → embed → 1:N search → write attendance” on the request path collapses under concurrency—API workers block, GPU/CPU inference saturates, and camera streams lag.

Industry deployments (e.g. multi-store attendance platforms, InfoQ facial-verification architectures, 2025 microservices attendance papers) consistently report:

- Embedding-model **throughput** becomes the bottleneck before gallery size does.
- Coupling detection to verification causes **camera lag** when the identity store is slow.
- Without queues, circuit breakers, and load leveling, spikes cascade into timeouts and missed check-ins.

## Why venues make it worse

- Narrow entry corridors create **burst arrivals**, not uniform Poisson traffic.
- Multi-venue concurrent events multiply peaks across regions.
- Staff expect sub-second UX; retries amplify load.

## Implications for CrewPulse

- Decouple capture/detection from verification and persistence (`vision-engine` vs `api-gateway` vs `worker-node`).
- Accept work asynchronously (BullMQ / Kafka), return fast ack, deliver match via poll/WebSocket.
- Scale detection and embedding horizontally during windows; keep verification capacity independent.
- Client-side quality gates (blur, face size, pose) cut useless inference under load.

## Sources (2025–2026)

- InfoQ, *Architecting Secure and Scalable Facial Verification Systems* (async queues, circuit breakers, decouple detection/verification).
- JEEICT 2025, scalable microservices face-attendance architecture (queues, independent scaling).
- Production attendance write-ups (e.g. ZepIris / Zepto): embedding bottlenecks at shift change; async inference.
