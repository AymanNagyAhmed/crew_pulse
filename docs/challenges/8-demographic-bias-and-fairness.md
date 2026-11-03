# Demographic bias and fairness differentials

**Domain:** Fairness / model evaluation  
**CrewPulse relevance:** Hospitality and catering crews are demographically diverse; unequal false reject/accept rates become payroll and discrimination risks.

## The challenge

NIST FRTE demographic evaluations (tables updated into 2025) show persistent differentials:

- **False positives (FMR)** can differ substantially across race/sex/age groups even on high-quality frontal images—driven largely by training representation and score calibration.
- **False negatives (FNMR)** are heavily influenced by **capture quality** (underexposure of darker skin, height-related pitch, etc.).
- Effects measured in 1:1 can be **magnified in 1:N** gallery search when affected groups are well represented in the gallery and probe stream—exactly the attendance setting.

Saying “the model is 99% accurate” without group-wise FMR/FNMR is insufficient for workforce products.

## Why venues make it worse

- Mixed lighting interacts with skin tone (challenge 2).
- Fixed cameras bias tall/short workers.
- Agency crews may be underrepresented in enrollment quality processes.

## Implications for CrewPulse

- Track match outcomes and threshold fails by demographic cohorts where lawful and consented (or by proxy operational metrics).
- Mitigate FNMR via capture design (lighting, camera height, quality gates); mitigate FMR via algorithm selection and calibration—not only “more data” on the ops side.
- Use venue-scoped galleries and adaptive thresholds carefully so fairness is measured, not accidentally worsened.
- Include fairness acceptance tests in `docs/plan.md` release gates.

## Sources (2025–2026)

- NIST FRTE Demographic Effects pages (updated 2025-03-05).
- NISTIR 8429 lineage: summarizing demographic differentials; developer vs photography mitigations.
- Attendance CV surveys listing demographic bias as a recurrent deployment concern.
