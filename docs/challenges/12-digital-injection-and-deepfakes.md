# Digital injection attacks and deepfakes

**Domain:** Adversarial security  
**CrewPulse relevance:** As check-in moves to phones and soft cameras, attackers can bypass the lens entirely.

## The challenge

NIST IFPC 2025 discussions flag **injection attacks** as a leading threat for modern identity verification: deepfakes or stolen face images fed through virtual cameras / sensor bypass, never presenting a physical PAI in front of a real sensor.

Traditional PAD (print/replay in front of a webcam) does **not** fully cover injection. Software that only sees decoded frames cannot assume those frames came from a honest CMOS sensor.

Workforce apps that allow BYOD selfies for remote clock-in inherit banking-style remote IDV risks without banking-grade device binding.

## Why venues make it worse

- Mixed fleet: kiosk cams (harder to inject) vs supervisor phones (easier).
- Temporary staff may install unverified check-in apps.
- Deepfake tooling is commodity; insider fraud motivation (payroll) is real.

## Implications for CrewPulse

- Prefer **managed stations** with locked-down OS and no virtual-camera drivers for payroll-grade punches.
- Mobile flows: OS-level camera attestation / SDK integrity where available; fall back to supervised capture.
- Treat remote selfie clock-in as higher risk: step-up auth, geo limits, active liveness, human review.
- Monitor for anomalous device models, capture pipelines, and perfect studio lighting on “kitchen” punches.

## Sources (2025–2026)

- NIST IFPC 2025 presentation (Klare): injection attacks and deepfakes as major IDV threat; sensor bypass.
- DHS RIVR / vendor PAD reporting: scenario testing with real participants still leaves digital injection largely out of classical PAD scopes (NIST FATE PAD also excluded injection).
