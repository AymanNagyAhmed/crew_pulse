# Capture station lighting SOP

CrewPulse face check-in fails closed on bad lighting: frames that are too dark, blown out, blurry, or too small are **rejected before embedding**. Clients should coach the worker using `reject_reasons` from vision detect/match — do not retry blindly under shift spikes.

## Station layout

1. **Covered entry** — place the camera under a canopy or indoors so daylight does not back-light faces at the door.
2. **Key light on faces** — one soft, frontal or 30° light aimed at the capture zone (avoid ceiling-only harsh downlight).
3. **Avoid mixed spectra extremes** — kitchen LED + open dock daylight creates underexposed faces; add fill light on the approach path.
4. **Stable exposure** — disable aggressive auto-exposure “hunt” if the device allows; lock exposure for the station once commissioned.
5. **Mount height** — camera roughly face-height for typical crew; keep face ≥ ~80 px in the frame (see `FACE_MIN_SIZE_PX`).

## Software gates (vision-engine)

| Env | Default | Meaning |
|-----|---------|---------|
| `FACE_MIN_LUMINANCE` | `0.15` | Reject underexposed face crops (`face_too_dark`) |
| `FACE_MAX_LUMINANCE` | `0.92` | Reject overexposed / clipped crops (`face_too_bright`) |
| `FACE_MAX_BLUR` | `0.65` | Reject soft focus (`face_too_blurry`) |
| `FACE_MIN_SIZE_PX` | `80` | Reject distant faces (`face_too_small`) |

Responses include `reject_reasons` (stable codes). Match stays `no_match` when every face fails gates — **no embed, no gallery search**.

## Commissioning checklist

- [ ] Walk a dark-skinned and light-skinned volunteer through the station at shift-start lighting.
- [ ] Confirm detect returns faces with mid luminance (~0.3–0.7) and empty `reject_reasons`.
- [ ] Dim lights / point at a bright window: expect `face_too_dark` / `face_too_bright` and no match.
- [ ] Document local lux reading at face plane if available; keep notes with venue id.

See also: `docs/challenges/2-low-light-and-harsh-illumination.md`, `services/vision-engine/docs/gateway-contract.md`.

**Fairness (C8):** Underexposure disproportionately raises FNMR for darker skin. Treat lighting commissioning as a fairness control, and run group-wise FMR/FNMR (or luminance-bin proxies) before releasing threshold changes — `services/vision-engine/docs/fairness-eval.md`, `docs/release-checklist.md`.
