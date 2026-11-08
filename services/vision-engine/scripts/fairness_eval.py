#!/usr/bin/env python3
"""CLI: group-wise FMR/FNMR fairness eval (C8 release gate).

Example:
  python scripts/fairness_eval.py \\
    --pairs tests/fixtures/fairness/synthetic_balanced.jsonl \\
    --threshold 0.75 --max-fnmr-gap 0.03
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.eval.fairness_io import load_pairs_jsonl
from app.eval.fairness_metrics import evaluate_fairness


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CrewPulse fairness FMR/FNMR eval")
    parser.add_argument("--pairs", type=Path, required=True, help="JSONL pair scores")
    parser.add_argument("--threshold", type=float, default=0.75)
    parser.add_argument("--max-fmr", type=float, default=1e-2)
    parser.add_argument("--max-fnmr", type=float, default=5e-2)
    parser.add_argument("--max-fmr-gap", type=float, default=5e-3)
    parser.add_argument("--max-fnmr-gap", type=float, default=3e-2)
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable report on stdout",
    )
    args = parser.parse_args(argv)

    pairs = load_pairs_jsonl(args.pairs)
    report = evaluate_fairness(
        pairs,
        threshold=args.threshold,
        max_fmr=args.max_fmr,
        max_fnmr=args.max_fnmr,
        max_fmr_gap=args.max_fmr_gap,
        max_fnmr_gap=args.max_fnmr_gap,
    )

    if args.json:
        payload = {
            "ok": report.ok,
            "threshold": report.threshold,
            "fmr_gap": report.fmr_gap,
            "fnmr_gap": report.fnmr_gap,
            "violations": list(report.violations),
            "groups": [
                {
                    "group": g.group,
                    "n_genuine": g.n_genuine,
                    "n_impostor": g.n_impostor,
                    "fmr": g.fmr,
                    "fnmr": g.fnmr,
                }
                for g in report.groups
            ],
        }
        print(json.dumps(payload, indent=2))
    else:
        print(f"threshold={report.threshold}")
        for g in report.groups:
            print(
                f"  {g.group}: n_gen={g.n_genuine} n_imp={g.n_impostor} "
                f"FMR={g.fmr} FNMR={g.fnmr}"
            )
        print(f"fmr_gap={report.fmr_gap} fnmr_gap={report.fnmr_gap}")
        if report.ok:
            print("PASS fairness gate")
        else:
            print("FAIL fairness gate:")
            for msg in report.violations:
                print(f"  - {msg}")

    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
