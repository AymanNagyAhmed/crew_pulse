# Multi-venue connectivity and edge operation

**Domain:** Infrastructure / edge  
**CrewPulse relevance:** Concurrent events across venues imply flaky Wi-Fi, captive portals, and cellular backups—cloud round-trips can miss shift windows.

## The challenge

On-prem attendance case studies (2025) report venues where internet drops for hours or cloud RTT (~200 ms+) is unacceptable when 80 workers queue at shift change. Pure cloud vision then fails operationally even if accuracy is excellent in the lab.

Challenges stack:

- **Edge vs cloud:** run detection/match locally vs central GPU farm.
- **Sync:** offline punches must upload without duplicates or clock skew fights.
- **Model/weights distribution:** updating DeepFace/RetinaFace assets across sites.
- **Multi-venue roster sync:** who is eligible to match at which site right now.

## Why venues make it worse

- Temporary event networks are unreliable by nature.
- Kitchens may forbid certain radios or have metal interference.
- Agencies operate many small sites—ops cannot babysit each GPU box.

## Implications for CrewPulse

- Design an **offline-capable** check-in path: local cache of venue roster embeddings + queue of attendance events.
- Conflict rules: server authority for payroll after sync; clear device clocks via NTP.
- Compose profiles for edge (`vision-engine` + Redis) vs full cloud.
- Bandwidth: send embeddings or quality-checked crops, not raw 4K video, when uplinking.

## Sources (2025–2026)

- developersEra / on-prem FaceNet + pgvector attendance (unreliable internet, sub-second local match).
- Multi-store attendance platforms scaling across hundreds of locations (roster + embedding growth).
