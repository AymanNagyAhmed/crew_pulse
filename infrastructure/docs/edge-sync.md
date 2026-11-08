# Edge connectivity & offline sync (C10)

Venues often lose Wi-Fi for hours. Door latency must not depend on a cloud round-trip. Edge nodes run **local match**; the cloud remains **payroll authority** after sync.

## Topology

| Mode | Compose | Role |
|------|---------|------|
| Cloud | `infrastructure/compose/docker-compose.yml` | api-gateway, worker-node, Postgres, shared Redis, vision |
| Edge | `infrastructure/compose/docker-compose.edge.yml` (`make up-edge`) | local Redis + vision-engine + nginx (`/vision/`) |
| Edge front (full stack) | main compose `--profile edge` | nginx on `:8080` fronting cloud gateway + vision |

```zsh
make up-edge
curl -sf http://127.0.0.1:18080/healthz
curl -sf http://127.0.0.1:18000/health
```

## Local match path

1. Station captures a **quality-checked face crop** (see `docs/edge-capture-contract.md`) — never uplink raw 4K video.
2. Edge calls local `POST /vision/v1/match` (nginx → vision-engine).
3. On match, enqueue an outbound punch with a stable `deviceEventId` (persist on disk/Redis until ACK).
4. When uplink returns, `POST {CLOUD}/v1/edge/sync/punches`.

## Roster cache

Edge pulls eligibility without vectors:

```http
GET /v1/edge/venues/{venueId}/shifts/{shiftId}/roster
```

Response: worker ids + template counts / model versions only. Refresh on a timer (e.g. every 15–60 min while online). Embeddings stay on managed edge storage derived from the same enroll pipeline + `BIOMETRIC_TEMPLATE_KEY` — never log or ship plaintext vectors over unmanaged links.

## Conflict / sync rules (server authority)

| Rule | Behavior |
|------|----------|
| Idempotency | `deviceEventId` is the primary key. Re-POST returns `duplicate` + original `attendanceId` — no second payroll row. |
| Payroll clock | Cloud `acceptedAt` is authoritative. `matchedAtLocal` is retained for audit / skew review. |
| Clock skew | Devices must NTP. Skew > 15 minutes is flagged on the sync item (`clock_skew_ms=…`) but the punch is still accepted once. |
| Identity | Edge may propose `workerId` after local match; cloud does not let clients invent final payroll without a prior match path. Assisted PIN/QR remains available online. |
| Uplink payload | `metadata` \| `crop` (≤ ~150KB base64) \| `embedding` on managed links. Reject oversized crops. |
| Offline queue | Edge retains punches until sync `written` or `duplicate`. Never drop after a successful local match without durable queue. |

## APIs (cloud api-gateway)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/edge/venues/:venueId/shifts/:shiftId/roster` | Roster snapshot for cache |
| POST | `/v1/edge/sync/punches` | Batch offline punch upload |
| GET | `/v1/edge/punches/:deviceEventId` | Lookup synced punch |

Example sync body:

```json
{
  "venueId": "ven_1",
  "edgeNodeId": "edge_kitchen_a",
  "punches": [
    {
      "deviceEventId": "dev_evt_001",
      "workerId": "wrk_1",
      "shiftId": "shf_1",
      "direction": "in",
      "matchedAtLocal": "2026-11-08T10:00:00.000Z",
      "score": 0.91,
      "uplink": "metadata"
    }
  ]
}
```

## Ops checklist before a shift

1. `make up-edge` healthy (`/healthz`, vision `/health`).
2. Roster pull succeeds for tonight’s venue/shift.
3. Cloud `make health` if uplink is expected; offline queue has disk headroom.
4. NTP OK on the station/kiosk.
