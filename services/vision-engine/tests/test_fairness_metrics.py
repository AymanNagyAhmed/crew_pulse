"""C8: group-wise FMR/FNMR harness + release gate."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.eval.fairness_io import load_pairs_jsonl
from app.eval.fairness_metrics import (
    PairScore,
    evaluate_fairness,
    group_rates,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "fairness"


def test_group_rates_basic() -> None:
    pairs = [
        PairScore(0.9, True, "a"),
        PairScore(0.5, True, "a"),
        PairScore(0.2, False, "a"),
        PairScore(0.8, False, "a"),
    ]
    rates = group_rates(pairs, threshold=0.75)
    assert len(rates) == 1
    assert rates[0].fnmr == pytest.approx(0.5)
    assert rates[0].fmr == pytest.approx(0.5)


def test_balanced_fixture_passes_default_gate() -> None:
    pairs = load_pairs_jsonl(FIXTURES / "synthetic_balanced.jsonl")
    report = evaluate_fairness(pairs, threshold=0.75)
    assert report.ok, report.violations
    assert report.fnmr_gap is not None
    assert report.fnmr_gap <= 0.03
    by_name = {g.group: g for g in report.groups}
    assert by_name["cohort_a"].fnmr == pytest.approx(0.05)
    assert by_name["cohort_b"].fnmr == pytest.approx(0.05)
    assert by_name["cohort_a"].fmr == pytest.approx(0.0)


def test_skewed_fixture_fails_fnmr_gap_gate() -> None:
    pairs = load_pairs_jsonl(FIXTURES / "synthetic_skewed_fnmr.jsonl")
    report = evaluate_fairness(
        pairs,
        threshold=0.75,
        max_fnmr=1.0,  # isolate differential gate
        max_fmr=1.0,
        max_fmr_gap=1.0,
        max_fnmr_gap=0.03,
    )
    assert not report.ok
    assert any("FNMR gap" in v for v in report.violations)
    assert report.fnmr_gap is not None
    assert report.fnmr_gap > 0.03
