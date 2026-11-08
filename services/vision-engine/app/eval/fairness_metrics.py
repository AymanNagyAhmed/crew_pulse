"""Group-wise FMR / FNMR for biometric release gates (C8).

Scores are similarity in [0, 1] (higher = more similar). At threshold τ:
- FMR  = fraction of impostor pairs with score ≥ τ (false accepts)
- FNMR = fraction of genuine pairs with score < τ (false rejects)

Cohort labels must be lawful/consented demographics **or** operational
proxies (e.g. luminance / pitch bins). Never invent unprotected attributes
from embeddings.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True, slots=True)
class PairScore:
    """One comparison used for threshold evaluation."""

    score: float
    genuine: bool
    group: str


@dataclass(frozen=True, slots=True)
class GroupRates:
    group: str
    threshold: float
    n_genuine: int
    n_impostor: int
    fmr: float | None
    fnmr: float | None


@dataclass(frozen=True, slots=True)
class FairnessReport:
    threshold: float
    groups: tuple[GroupRates, ...]
    fmr_gap: float | None
    fnmr_gap: float | None
    violations: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return len(self.violations) == 0


def rate_at_or_above(scores: Iterable[float], threshold: float) -> float | None:
    values = list(scores)
    if not values:
        return None
    return sum(1 for s in values if s >= threshold) / len(values)


def rate_below(scores: Iterable[float], threshold: float) -> float | None:
    values = list(scores)
    if not values:
        return None
    return sum(1 for s in values if s < threshold) / len(values)


def group_rates(pairs: Iterable[PairScore], threshold: float) -> list[GroupRates]:
    by_group: dict[str, list[PairScore]] = {}
    for pair in pairs:
        by_group.setdefault(pair.group, []).append(pair)

    out: list[GroupRates] = []
    for group, rows in sorted(by_group.items()):
        genuine = [p.score for p in rows if p.genuine]
        impostor = [p.score for p in rows if not p.genuine]
        out.append(
            GroupRates(
                group=group,
                threshold=threshold,
                n_genuine=len(genuine),
                n_impostor=len(impostor),
                fmr=rate_at_or_above(impostor, threshold),
                fnmr=rate_below(genuine, threshold),
            )
        )
    return out


def _gap(values: list[float | None]) -> float | None:
    present = [v for v in values if v is not None]
    if len(present) < 2:
        return None
    return max(present) - min(present)


def evaluate_fairness(
    pairs: Iterable[PairScore],
    *,
    threshold: float,
    max_fmr: float = 1e-2,
    max_fnmr: float = 5e-2,
    max_fmr_gap: float = 5e-3,
    max_fnmr_gap: float = 3e-2,
) -> FairnessReport:
    """Compute per-group rates and apply absolute + differential gates."""
    groups = tuple(group_rates(pairs, threshold))
    fmr_gap = _gap([g.fmr for g in groups])
    fnmr_gap = _gap([g.fnmr for g in groups])

    violations: list[str] = []
    for g in groups:
        if g.fmr is not None and g.fmr > max_fmr:
            violations.append(
                f"{g.group}: FMR {g.fmr:.4f} exceeds max_fmr {max_fmr:.4f}"
            )
        if g.fnmr is not None and g.fnmr > max_fnmr:
            violations.append(
                f"{g.group}: FNMR {g.fnmr:.4f} exceeds max_fnmr {max_fnmr:.4f}"
            )
    if fmr_gap is not None and fmr_gap > max_fmr_gap:
        violations.append(
            f"FMR gap {fmr_gap:.4f} exceeds max_fmr_gap {max_fmr_gap:.4f}"
        )
    if fnmr_gap is not None and fnmr_gap > max_fnmr_gap:
        violations.append(
            f"FNMR gap {fnmr_gap:.4f} exceeds max_fnmr_gap {max_fnmr_gap:.4f}"
        )

    return FairnessReport(
        threshold=threshold,
        groups=groups,
        fmr_gap=fmr_gap,
        fnmr_gap=fnmr_gap,
        violations=tuple(violations),
    )


def pairs_from_jsonl_rows(rows: Iterable[dict]) -> list[PairScore]:
    """Parse JSONL objects: score, genuine, group."""
    out: list[PairScore] = []
    for i, row in enumerate(rows):
        try:
            score = float(row["score"])
            genuine = bool(row["genuine"])
            group = str(row["group"]).strip()
        except (KeyError, TypeError, ValueError) as err:
            raise ValueError(f"invalid fairness pair at row {i}: {err}") from err
        if not group:
            raise ValueError(f"empty group at row {i}")
        if not 0.0 <= score <= 1.0:
            raise ValueError(f"score out of range at row {i}: {score}")
        out.append(PairScore(score=score, genuine=genuine, group=group))
    return out
