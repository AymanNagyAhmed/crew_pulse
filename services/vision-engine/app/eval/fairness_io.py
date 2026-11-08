"""Load fairness pair fixtures from JSONL."""

from __future__ import annotations

import json
from pathlib import Path

from app.eval.fairness_metrics import PairScore, pairs_from_jsonl_rows


def load_pairs_jsonl(path: Path | str) -> list[PairScore]:
    file_path = Path(path)
    rows: list[dict] = []
    with file_path.open(encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            text = line.strip()
            if not text or text.startswith("#"):
                continue
            try:
                obj = json.loads(text)
            except json.JSONDecodeError as err:
                raise ValueError(f"{file_path}:{line_no}: {err}") from err
            if not isinstance(obj, dict):
                raise ValueError(f"{file_path}:{line_no}: expected JSON object")
            rows.append(obj)
    return pairs_from_jsonl_rows(rows)
