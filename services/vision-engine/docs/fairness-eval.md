# Demographic fairness eval (C8)

Workforce face attendance must not ship on a single overall accuracy number. CrewPulse measures **group-wise FMR and FNMR** before releasing threshold or model changes.

## Lawful labels only

Use **consented demographic cohorts** where policy and DPIA allow, **or** operational proxies that do not invent protected attributes from embeddings:

| Proxy bin | Why it helps FNMR |
|-----------|-------------------|
| Face luminance bands | Underexposure hits darker skin harder (NIST / C2) |
| Pitch / camera height bins | Tall/short workers at fixed mounts (C6) |
| Occlusion / PPE flags | Masked kitchen crews (C5) |

Never log raw embeddings for fairness analytics. Prefer match scores, reject codes, and cohort ids agreed with legal/privacy.

## Capture & threshold mitigations (linked)

FNMR is often a **photography** problem; FMR is often a **model/calibration** problem.

| Mitigation | Where |
|------------|--------|
| Lighting / luminance gates | `infrastructure/docs/station-lighting-sop.md` (C2) |
| Pose / blur / face size | `docs/edge-capture-contract.md` (C6) |
| PPE assisted fallback (not silent reject) | `infrastructure/docs/ppe-occlusion-sop.md` (C5) |
| Venue/shift-scoped 1:N gallery | `infrastructure/docs/vector-gallery.md` (C4) — smaller N reduces FMR pressure |
| Match threshold | `FACE_MATCH_THRESHOLD` / vision match `threshold` field — calibrate with this harness |

Commission stations with diverse volunteers (see lighting SOP checklist). Prefer multi-template enrollment so one poor hire photo does not dominate FNMR for a cohort.

## Harness

Pure Python metrics live in `app/eval/fairness_metrics.py`. Pair fixtures are JSONL:

```json
{"score": 0.91, "genuine": true, "group": "cohort_a"}
{"score": 0.22, "genuine": false, "group": "cohort_a"}
```

Run (from `services/vision-engine`, venv active):

```zsh
python scripts/fairness_eval.py \
  --pairs tests/fixtures/fairness/synthetic_balanced.jsonl \
  --threshold 0.75 \
  --max-fmr 0.01 \
  --max-fnmr 0.05 \
  --max-fmr-gap 0.005 \
  --max-fnmr-gap 0.03
```

Exit code `0` = pass, `1` = gate failure. Add `--json` for CI artifacts.

Unit coverage: `tests/test_fairness_metrics.py` (balanced pass + skewed FNMR fail).

## Release gate

`docs/release-checklist.md` requires this eval (or an updated production pair set) to **PASS** before changing embedding model, match threshold, or quality-gate defaults that affect FNMR/FMR.
