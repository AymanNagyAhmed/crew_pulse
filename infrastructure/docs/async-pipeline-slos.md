# Async pipeline SLOs & pre-shift alerts (C9)

Face verification is a distributed path: enqueue → queue wait → vision match → verified attendance write. Treat latency and consistency as product requirements, not averages of a healthy lab run.

## SLOs (local / default)

| Signal | Target | Source |
|--------|--------|--------|
| p95 enqueue → decision | ≤ `CHECK_IN_DECISION_SLO_P95_MS` (default **3000 ms**) on-site | Measure from station clock: `POST /v1/attendance/check-ins` → poll `GET /v1/attendance/jobs/:jobId` until `state` ≠ `queued` |
| UX job states | `queued` → `matched` \| `needs_review` \| `no_match` \| … | Gateway maps BullMQ + processor result |
| Duplicate delivery | No second verified attendance row | Redis `SET NX` + store idempotency |

Tune the p95 target per venue hardware (edge GPU vs remote vision). Mean latency is not the door experience.

## Client contract

1. `POST /v1/attendance/check-ins` → **202** + `{ jobId, state: "queued" }`.
2. Poll `GET /v1/attendance/jobs/:jobId` and read **`state`** (UX), not raw BullMQ:
   - `queued` — waiting or actively matching
   - `matched` — verified attendance written
   - `needs_review` — capture kept; no payroll punch
   - `failed` — vision exhausted retries / hard failure
3. On `503 CHECK_IN_QUEUE_BACKPRESSURE`, show queueing UI or offer assisted PIN/QR/badge.

## Capture history vs verified attendance

| Store | Purpose |
|-------|---------|
| Capture history (`cap_*`) | Every terminal attempt (match / no_match / needs_review / …) without image bytes |
| Verified attendance | Payroll-grade punch only when decision is `matched` (and not cooldown-blocked) |

Ids differ: a capture may exist without an attendance row (`needs_review`). Never treat capture count as headcount.

## Backpressure

| Env | Default | Meaning |
|-----|---------|---------|
| `CHECK_IN_QUEUE_WARN_DEPTH` | 50 | Alert / page before shift if depth ≥ warn |
| `CHECK_IN_QUEUE_MAX_WAITING` | 200 | Gateway rejects new enqueues with **503** |

Depth = BullMQ `waiting` + `delayed` on `attendance-check-in`.

### Pre-shift checklist

```zsh
# Gateway metrics
curl -s http://localhost:3000/v1/attendance/queue-metrics | jq '.data'

# Worker health includes queueMetrics + visionCircuit + backpressure.alertBeforeShift
curl -s http://localhost:3001/v1/health | jq '.data.backpressure, .data.visionCircuit, .data.queueMetrics'
```

Alert when `backpressure` is `warn` or `rejecting`, or worker `alertBeforeShift` is `queue_depth_high`, **before** doors open — not after the first missed punch.

## Vision circuit breaker

Worker HTTP client to vision-engine:

| Env | Default | Behavior |
|-----|---------|----------|
| `VISION_CIRCUIT_FAILURE_THRESHOLD` | 5 | Consecutive failures → open |
| `VISION_CIRCUIT_OPEN_MS` | 30000 | Cool-down before half-open probe |

HTTP **429** opens the circuit immediately so BullMQ retries do not stampede a rate-limited GPU. Transient failures release the idempotency claim so backoff retries can re-run match.

## Idempotency

- Client / gateway: `Idempotency-Key` becomes BullMQ `jobId`.
- Worker: Redis `worker:idempotency:attendance-check-in:<key>` (`SET NX`).
- Re-delivery after a successful write returns `duplicate` with the original `attendanceId` — no second row.
