# PPE / mask occlusion SOP (C5)

Kitchen and catering PPE (masks, hairnets, face shields) often removes mid-face cues that generic face models need. CrewPulse must **not** treat heavy occlusion as a silent biometric miss.

## Runtime behavior

1. **Detect** runs quality → PAD → **occlusion** before embed.
2. Heavy lower-face coverage yields `reject_reasons` of `face_occluded` or `ppe_occlusion` and **no** embedding.
3. **Match** returns `decision: "assisted_fallback"` (not `no_match`) so clients open assisted flow.
4. **Assisted punch** (api-gateway): `POST /v1/attendance/assisted-check-ins` with `supervisor_pin` or `qr`.

Accepted faces include `occlusion_score` (0 clear → 1 heavy) for metrics; gateways should not surface the raw score as a user verdict beyond the reject codes.

## Station / enrollment guidance

- Prefer **PPE-on and PPE-off** enrollment templates when policy allows (`template_version` or separate `model_version` tags in the gallery).
- Do **not** require mask removal for payroll punches if hygiene rules forbid it — use assisted PIN/QR instead.
- Brief controlled unmask only when site health policy explicitly permits and queues stay short.
- Fogged shields count as occlusion; wipe or use assisted fallback.

## Config

| Variable | Default | Meaning |
|----------|---------|---------|
| `OCCLUSION_ENABLED` | `true` | Run occlusion gate |
| `OCCLUSION_MAX_SCORE` | `0.55` | At/above → assisted path |
| `ASSISTED_SUPERVISOR_PIN` | `dev-pin-change-me` | Local/dev PIN (change in real deploys) |
| `ASSISTED_QR_TOKENS` | `dev-qr-change-me` | Comma-separated station QR payloads |

Heuristics are stubs until a masked-face model ships; reject codes and assisted API stay stable.
