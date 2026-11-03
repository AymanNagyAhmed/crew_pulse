# Presentation attacks and liveness (photo / video spoofing)

**Domain:** Security / biometrics  
**CrewPulse relevance:** Buddy punching with a printed photo or phone replay remains a primary fraud vector for attendance systems.

## The challenge

**Presentation attack detection (PAD)** must reject printouts, screen replays, masks, and other presentation attack instruments (PAIs) while keeping bona fide rejection (BPCER) low enough for shift lines.

NIST FATE PAD (NISTIR 8491) and ongoing DHS RIVR (2026 reporting) show:

- Accuracy varies widely by PAI type and by impersonation vs evasion.
- Zoomed print/replay (frame and hands cropped out) remains much harder than framed photo attacks.
- Many algorithms improve with **video** vs a single still.
- Passive software PAD often struggles to meet strict APCER goals even when BPCER is usable; active challenge-response can block more attacks but hurts UX and transaction time.
- Fusion of multiple PAD scores can beat a single top algorithm on many attack categories.

Generalization across unseen illumination, devices, and PAIs (classic OULU-NPU-style covariates) remains weak in production.

## Why venues make it worse

- High throughput pushes operators toward **passive**, single-frame capture—exactly where PAD is weakest.
- Shared tablets at entrances enable replay from another worker’s phone.
- Staff wear uniforms and stand at fixed distances, making printed bust shots easier to stage.

## Implications for CrewPulse

- Treat PAD as a first-class stage in `vision-engine`, not an afterthought threshold on match score.
- Prefer short video / multi-frame passive cues where latency budgets allow; reserve active liveness for high-risk flows (enrollment, disputed punches).
- Risk-based thresholds: tighter for payroll-critical check-ins, looser for low-stakes presence hints.
- Rate-limit failed liveness attempts per device; never expose raw liveness scores to clients.
- Continuous audit sampling of accepted frames for human review (vendor and NIST operational-testing guidance).

## Sources (2025–2026)

- NISTIR 8491 — FATE Part 10, passive software PAD.
- DHS RIVR PAD track reporting (Biometric Update, Apr 2026): active vs passive trade-offs.
- WACV 2026 PAD robustness under low light / auto-capture.
- Amazon Rekognition Face Liveness operational recommendations.
