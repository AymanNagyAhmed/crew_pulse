# Low light and harsh illumination

**Domain:** Computer vision / PAD robustness  
**CrewPulse relevance:** Kitchens, loading docks, outdoor event tents, and dim banquet corridors are common capture environments—not office lighting.

## The challenge

Face matchers and **presentation attack detection (PAD)** degrade sharply outside controlled lighting. Recent WACV 2026 scenario testing of commercial PAD in remote identity validation found:

- Low light raised the **odds of PAD error ~4×** vs office light.
- Auto-capture workflows roughly **doubled** error odds.
- Only **1 of 9** tested PAD systems kept BPCERmax below 3% across all scenarios; low-light success against that benchmark was ~11%.

Recognition also suffers from underexposure (especially darker skin tones), overexposure, strong backlight at venue doors, and mixed LED/halogen spectra in kitchens.

## Why venues make it worse

- Entrances often face daylight + indoor tungsten/LED contrast.
- Steam, grease haze, and moving staff change exposure frame to frame.
- Device auto-exposure and auto-capture fight the operator; “hands-free” modes hurt PAD and match quality.

## Implications for CrewPulse

- Specify **capture stations** (directional lighting, covered entries) in deployment guides—not only model choice.
- Gate inference on luminance / face-quality scores; reject and coach the user instead of forcing a bad match.
- Evaluate PAD and matchers on **venue-like** low-light sets, not only lab office light (WACV 2026 lesson).
- Prefer IR/assisted capture only where hardware budget and privacy policy allow; software-only PAD is fragile in the dark.

## Sources (2025–2026)

- Howard et al., WACV 2026 workshop: *Robustness of Presentation Attack Detection in Remote Identity Validation Scenarios*.
- NIST FRTE demographics notes: poor lighting / underexposure drives false-negative differentials.
- AWS Rekognition Face Liveness guidance: avoid extremes of dark/bright; audit spoof images post-deploy.
