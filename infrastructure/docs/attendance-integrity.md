# Attendance integrity & duplicates (C11)

Payroll needs trustworthy punches — not just a face score.

## Idempotency

| Layer | Key |
|-------|-----|
| Client / BullMQ | `Idempotency-Key` → job id |
| Verified write | Same key in attendance store |
| Composite bucket | `(workerId, venueId, shiftId, direction, timeBucket)` via `buildAttendanceIdempotencyKey` |

Re-delivery or a second client key in the same time bucket returns `duplicate` / `cooldown` — **no second payroll row**.

## Cooldown

| Env | Meaning |
|-----|---------|
| `ATTENDANCE_COOLDOWN_SECONDS` | Global default (e.g. 60) |
| `ATTENDANCE_COOLDOWN_BY_VENUE` | `ven_a:90,ven_b:45` per-venue overrides |

Crowded doors linger in frame; cooldown + composite bucket suppress double punches.

## Station / geofence binding

| Env | Meaning |
|-----|---------|
| `ATTENDANCE_REQUIRE_STATION` | `true` → `stationId` required on check-in |
| `ATTENDANCE_STATION_VENUES` | `door_a:ven_1,door_b:ven_1` |
| `ATTENDANCE_VENUE_GEOFENCE` | `ven_1:25.0:55.0:150` (lat:lng:radiusMeters), `;`-separated |

Mismatched station→venue or geofence miss → **403** + immutable `station_reject` audit.

## Overrides (audit only)

```http
POST /v1/attendance/overrides
GET  /v1/attendance/audit
```

Supervisor overrides append an audit row (`payrollWritten: false`). They do **not** create verified attendance. Use assisted check-in or a separate payroll correction process when a punch must exist.

Low-confidence accepts and PAD fails should also land in the same audit store (`low_confidence_accept`, `pad_fail`).
