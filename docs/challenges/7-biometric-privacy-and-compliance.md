# Biometric privacy, retention, and compliance

**Domain:** Privacy / legal / security  
**CrewPulse relevance:** Embeddings and face images are special-category biometric data when used to uniquely identify workers.

## The challenge

Workplace facial attendance sits under GDPR/UK GDPR-style regimes (and growing AI Act “high-risk” scrutiny for biometric ID in some contexts). Controllers must justify necessity, run DPIAs, offer genuine alternatives, and secure templates.

Key technical-privacy gaps highlighted in 2025 surveys and regulator guidance:

- **Embeddings are not automatically safe.** Template inversion / reconstruction research shows vectors can leak appearance; “we only store embeddings” is insufficient without encryption, access control, and unlinkability design.
- Templates must not sit beside raw images and identity directories in one casually readable store.
- Retention: delete or rotate templates when employment or purpose ends; backups and vendor copies count.
- Multi-actor pipelines (gateway, vision service, vector DB, analytics) expand leakage surfaces (raw frames → features → templates → logs → APIs).

## Why venues make it worse

- Multi-employer catering sites blur who is the controller vs processor.
- Temporary staff increase enroll/erase churn.
- Cameras in shared spaces raise “monitoring at work” concerns beyond clock-in.

## Implications for CrewPulse

- Minimize: prefer encrypted templates over long-lived raw images; short-lived tokens for in-flight frames.
- Separate embedding store ACLs from HR identity tables; never log full vectors.
- Automate retention and erasure with audit evidence; document model/vendor subprocessors.
- Provide non-biometric fallback (badge/PIN) that is practically usable—not a punitive opt-out.
- Align product claims with DPIA language early; privacy is an architecture constraint, not a policy PDF.

## Sources (2025–2026)

- UK ICO biometric / monitoring-workers guidance (templates, security, reverse engineering).
- Springer *Discover Applied Sciences* 2025 survey: privacy across generation, inference, storage; inversion risks.
- PMC 2025 transport FR privacy review: leakage taxonomy L1–L6 (raw → embeddings → logs).
