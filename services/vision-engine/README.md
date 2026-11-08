# vision-engine

FastAPI face detection / embedding service for CrewPulse.

## Model weights cache

DeepFace / RetinaFace download ONNX (and related) weights on first use into:

- `$DEEPFACE_HOME/.deepface/weights/` (DeepFace nests `.deepface` under `DEEPFACE_HOME`)
- Default `DEEPFACE_HOME` is the user home → `~/.deepface/weights/`

Keep this directory on the **Linux filesystem** (WSL home or project cache), not `/mnt/c`.

```zsh
# optional override (weights → $DEEPFACE_HOME/.deepface/weights)
export DEEPFACE_HOME=$HOME
cd services/vision-engine
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Set `VISION_STUB=true` to skip model load (deterministic stubs for offline CI).

## Quality gates + PAD + occlusion

Before embedding: minimum face size (`FACE_MIN_SIZE_PX`), max blur, luminance band, yaw/pitch bounds (`FACE_MAX_YAW_DEG`, `FACE_MAX_PITCH_DEG`), passive PAD (`PAD_ENABLED`, `PAD_MIN_SCORE`), then PPE/mask occlusion (`OCCLUSION_ENABLED`, `OCCLUSION_MAX_SCORE`). Rejected faces are omitted from `faces[]` (not embedded); coach via `reject_reasons` (`face_too_dark`, `face_too_blurry`, `face_yaw_too_extreme`, `pad_print`, `face_occluded`, …). Heavy occlusion makes `/v1/match` return `assisted_fallback` (api-gateway PIN/QR). Accepted faces may include `pad_score` and `occlusion_score`. Edge framing: `docs/edge-capture-contract.md`. PPE SOP: `infrastructure/docs/ppe-occlusion-sop.md`.

## Fairness (C8)

Group-wise FMR/FNMR harness: `docs/fairness-eval.md`, `python scripts/fairness_eval.py --pairs …`. Release gate: repo `docs/release-checklist.md`. Capture mitigations stay primary for FNMR (lighting SOP, this edge contract).

## Privacy

API responses expose `embedding_dim` and scores only — never raw embedding vectors.
