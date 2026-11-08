# Managed station deploy notes (C12)

Digital injection (virtual cameras, deepfake file feeds) bypasses classical PAD. Payroll-grade punches should prefer **managed stations** with a locked camera path — not BYOD selfies.

## Prefer managed kiosks

| Control | Requirement |
|---------|-------------|
| OS | Locked-down image (kiosk mode); no admin for floor staff |
| Camera | Physical USB/CSI camera only; **block virtual-camera drivers** (e.g. v4l2loopback, ManyCam, OBS virtual cam) |
| App | Signed station agent; no sideloaded check-in APKs for payroll |
| Capture source | Clients must send `captureSource: "managed_station"` |
| Pipeline | Prefer `pipelineHint: "native_camera"`; treat `virtual_camera` / `file_inject` as high risk |

## Mobile / remote selfie (high risk)

BYOD and remote selfie clock-in inherit remote-IDV injection risk. Policy (`CAPTURE_PAYROLL_ALLOWED_SOURCES`, default `managed_station`):

1. **Step-up** — include `stepUp: { method, credential }` (supervisor PIN / station QR / badge) so a human supervises the capture; match may proceed.
2. **Review** — set `acceptReview: true` to enqueue with `forceReview`; worker returns `needs_review` and **does not** write payroll.
3. Otherwise API returns **403 `CAPTURE_STEP_UP_REQUIRED`**.

Optional mobile mitigations when available: `deviceAttestation: platform|hardware`, geo limits, active liveness (vision PAD), human review queue.

## Anomaly hooks

Clients / agents may send `anomalyFlags` such as:

- `perfect_studio_lighting` — unlikely in a kitchen; escalate
- `unknown_device_model` — unexplained device

These force the high-risk path even on a claimed managed station.

## Local config

```env
CAPTURE_PAYROLL_ALLOWED_SOURCES=managed_station
# Optional (not recommended for payroll): managed_station,mobile_byod
```

See also: `docs/edge-capture-contract.md`, PAD / lighting SOPs under `infrastructure/docs/`.
