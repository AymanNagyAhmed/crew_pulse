# Edge capture contract (C6)

Push framing QA **left** to the station / mobile client before upload. Vision-engine still enforces the same gates server-side; clients should map `reject_reasons` to on-screen coaching.

## Pre-upload checks (recommended)

| Check | Client action | Server reject code |
|-------|---------------|--------------------|
| Face box too small / too far | “Step closer” | `face_too_small` |
| Too dark / blown out | “Improve lighting” | `face_too_dark` / `face_too_bright` |
| Motion blur | “Hold still” | `face_too_blurry` |
| \|yaw\| above bound | “Face the camera” | `face_yaw_too_extreme` |
| \|pitch\| above bound | “Raise/lower camera or chin” | `face_pitch_too_extreme` |
| PAD fail | Fail closed / retry live | `pad_print` / `pad_replay` / `pad_fail` |
| Heavy PPE / mask | Offer assisted PIN/QR | `face_occluded` / `ppe_occlusion` → match `assisted_fallback` |

Default server bounds (env-overridable):

- `FACE_MIN_SIZE_PX=80`
- `FACE_MAX_BLUR=0.65`
- `FACE_MAX_YAW_DEG=25`
- `FACE_MAX_PITCH_DEG=20`

Show a face silhouette / oval at kiosks; adjust mount height for mixed-height crews (pitch errors are a common FN driver).

## Detect response for coaching

`POST /v1/detect` returns:

- `faces[].quality` — `blur`, `luminance`, `face_size_px`, `yaw_deg`, `pitch_deg`
- `reject_reasons` — stable codes (no embedding when rejected)

Do **not** force match on reject. Prefer another frame; for occlusion use assisted check-in.

## Enrollment (multi-template)

Bad hire photos poison galleries for months. Enroll **multiple** frontal frames per worker via api-gateway:

`POST /v1/gallery/enroll`

```json
{
  "workerId": "wrk_42",
  "modelVersion": "Facenet512",
  "templates": [
    {
      "embedding": [/* 512 floats from trusted enroll path */],
      "captureQa": {
        "blur": 0.12,
        "faceSizePx": 160,
        "yawDeg": 3.0,
        "pitchDeg": -1.0,
        "detectionScore": 0.97
      }
    },
    {
      "embedding": [/* second pose / PPE-off variant */],
      "captureQa": {
        "blur": 0.15,
        "faceSizePx": 150,
        "yawDeg": -4.0,
        "pitchDeg": 2.0,
        "detectionScore": 0.95
      }
    }
  ]
}
```

Enrollment QA is **stricter** than check-in (blur ≤ 0.45, \|yaw\| ≤ 20°, \|pitch\| ≤ 15°, face ≥ 100px, detection ≥ 0.85). Failures return `422 ENROLLMENT_QUALITY_FAILED` with field details the UI can show.

List stored variants: `GET /v1/gallery/workers/{workerId}/templates`.

## Match path

`POST /v1/match` propagates the same `reject_reasons`. Edge clients should treat framing codes as coachable and only escalate assisted fallback for occlusion codes.

## Fairness (C8)

Fixed camera height and pitch bias tall/short workers (FNMR). Keep framing gates and multi-template enroll; measure group-wise or pitch-bin FMR/FNMR before releasing threshold changes — `docs/fairness-eval.md`, root `docs/release-checklist.md`.
