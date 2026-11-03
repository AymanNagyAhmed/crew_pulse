# PPE, masks, and facial occlusion

**Domain:** Computer vision / workplace safety  
**CrewPulse relevance:** Kitchens and catering lines require hairnets, masks, face shields, and sometimes eyewear—exactly the occlusions that break generic face models.

## The challenge

Recognition depends on periocular and mid-face structure. Masks, shields, and PPE remove or distort those cues. Research through 2025 shows:

- Mask coverage level strongly affects identification speed and accuracy; partial/mouth-focused coverage can be especially disruptive.
- Industrial attendance deployments (construction, factories) report helmets/masks as first-class failure modes; models without masked-face augmentation underperform.
- Non-frontal views compound occlusion failures (mask + profile glance ≈ hard miss).
- “Remove mask at the camera” policies conflict with hygiene rules and slow queues.

## Why venues make it worse

- Food-safety PPE is **mandatory**, not optional fashion.
- Steam and condensation fog glasses and shields.
- Agency staff may enroll without PPE then check in fully geared → domain shift between gallery and probe.

## Implications for CrewPulse

- Enrollment should capture **PPE-on and PPE-off** templates where policy allows, or fine-tune / select models trained for masked faces (e.g. InsightFace masked-face challenge lessons).
- Detect heavy occlusion and route to assisted flow (supervisor PIN, QR backup) instead of silent false rejects.
- Document site SOP: brief controlled unmask only if health policy permits; otherwise invest in occlusion-robust models.
- Evaluate on real kitchen PPE imagery, not only synthetic mask overlays.

## Sources (2025–2026)

- Frontiers / PMC 2025: *Challenges of face identification with varied mask coverage in the post COVID-19 era*.
- Industrial attendance systems literature (InsightFace + PPE protocols; require brief mask lower vs PPE-aware models).
- Attendance CV surveys citing masks/scarves as recurrent failure modes.
