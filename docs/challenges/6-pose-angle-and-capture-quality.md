# Pose, angle, and capture quality

**Domain:** Computer vision / UX at the door  
**CrewPulse relevance:** Workers rush past entrance cams with phones in hand; they rarely present a passport-style frontal pose.

## The challenge

Even strong ArcFace-class matchers need a usable face crop. Common failure modes in attendance rollouts:

- Extreme close-ups, off-angle selfies, motion blur, and roll/yaw beyond training distribution.
- Non-frontal views frequently labeled “unknown” even when identity would match frontally.
- Poor **enrollment** images poison the gallery: one blurry hire photo elevates false non-matches for months.
- On-device framing feedback dramatically improves success rates once added (production attendance platforms).

NIST demographic work also notes that pitch errors from cameras not adjusted for height drive false negatives—relevant for mixed-height crews at fixed wall mounts.

## Why venues make it worse

- Tall/short staff share one fixed kiosk height.
- Bags, trays, and carts force awkward approach angles.
- Multi-angle marketing claims for CrewPulse-class systems must still cope with **motion** and partial faces, not studio multi-view sets.

## Implications for CrewPulse

- Push quality validation **left** to the edge client: face size, blur, landmarks, yaw/pitch bounds before upload (cuts cloud cost and bad inferences).
- Enforce enrollment QA (resolution, detection confidence, multiple frames); store multi-template galleries per worker.
- Mount guidance + on-screen silhouette / real-time feedback at check-in stations.
- Confidence-based manual review below threshold instead of forcing a wrong identity.

## Sources (2025–2026)

- ZepIris / Zepto: face positioning failures; real-time framing validation.
- InfoQ facial verification: client-side normalization (rotation, lighting, blur) before transmission.
- Industrial / academic attendance pipelines: frontal pose as mandatory for reliable match; enrollment quality gates.
