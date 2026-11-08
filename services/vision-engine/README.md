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

## Quality gates + PAD

Before embedding: minimum face size (`FACE_MIN_SIZE_PX`), max blur, luminance band, then passive PAD (`PAD_ENABLED`, `PAD_MIN_SCORE`). Rejected faces are omitted from `faces[]` (not embedded); coach via `reject_reasons` (`face_too_dark`, `pad_print`, `pad_replay`, …). Accepted faces may include `pad_score` (0 spoof → 1 live).

## Privacy

API responses expose `embedding_dim` and scores only — never raw embedding vectors.
