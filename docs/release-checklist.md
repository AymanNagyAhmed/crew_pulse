# CrewPulse release checklist

Use before merging threshold, model, or capture-gate changes that affect attendance match rates. Challenge mitigations: `docs/plan_to_cover_challenges.md`.

## Always

- [ ] Targeted tests for touched services pass (`targeted-tests.mdc`)
- [ ] `make health` on a local or staging stack
- [ ] No embedding vectors in API responses or application logs (C7)
- [ ] Challenge checklist / ADR ownership still accurate for the change

## Fairness gate (C8) — required for match/threshold/model releases

- [ ] Group-wise FMR/FNMR eval run with lawful cohort labels **or** documented operational proxies
- [ ] `python scripts/fairness_eval.py --pairs <set> …` exits **0** (see `services/vision-engine/docs/fairness-eval.md`)
- [ ] Absolute and differential limits reviewed (`max_fmr`, `max_fnmr`, `max_fmr_gap`, `max_fnmr_gap`)
- [ ] Capture mitigations still linked if FNMR rose: lighting SOP (C2), pose/blur (C6), PPE assisted path (C5)
- [ ] Venue-scoped gallery / roster size considered (C4) — 1:N can magnify FMR differentials

## Vision / capture

- [ ] Quality / PAD / occlusion reject codes unchanged or documented for clients
- [ ] Station lighting commissioning notes updated when defaults change

## Privacy / attendance

- [ ] Biometric erase/retention still documented (`infrastructure/docs/biometric-privacy.md`)
- [ ] Non-biometric fallback (PIN / QR / badge) remains usable
