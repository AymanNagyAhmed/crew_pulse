# Attendance integrity, duplicates, and buddy punching

**Domain:** Product / fraud / data integrity  
**CrewPulse relevance:** Payroll and compliance audits need trustworthy arrival/departure events—not just a face match score.

## The challenge

Even with correct recognition, operational integrity fails when:

- The same worker is matched **repeatedly** in a few seconds (queue lingering, camera FPS).
- Two workers share a device session or a spoof bypasses PAD (challenge 3).
- Clock-in location does not bind to the claimed venue/shift.
- Raw detections are conflated with **verified** attendance in reporting.

2025 microservice attendance work highlights **cooldown policies** to suppress duplicate entries and separate raw history from AI-verified history for clean audits.

## Why venues make it worse

- Crowded doors produce multiple detections per person.
- Role changes mid-event (runner → bartender) need assignment integrity, not only identity.
- Supervisors need override flows that remain auditable.

## Implications for CrewPulse

- Idempotent event keys: `(workerId, venueId, shiftId, direction, timeBucket)`.
- Cooldown / hysteresis windows configurable per venue.
- Bind matches to geofence / device attestation / station id.
- Immutable audit log of overrides, PAD fails, and low-confidence accepts.
- Never allow clients to submit final “I am worker X” without server-side match + policy checks.

## Sources (2025–2026)

- JEEICT 2025: cooldown against duplicates; history vs history_ai.
- InfoQ: risk-based decision engine; confidence as probabilistic input, not binary gospel.
