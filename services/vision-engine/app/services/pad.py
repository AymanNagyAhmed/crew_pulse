"""Passive single-frame PAD (presentation attack detection) before embed.

Stub heuristics for print / screen-replay cues. Swap the scoring body later for a
real anti-spoof model without changing reject codes or gate placement.
"""

from __future__ import annotations

from typing import Literal

import cv2
import numpy as np

from app.core.settings import Settings

PadHint = Literal["print", "replay", "live"]


def _print_signal(bgr: np.ndarray) -> float:
    """High when the crop looks like a desaturated / paper print."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    sat = float(np.mean(hsv[:, :, 1])) / 255.0
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    # Fine texture residual after mild blur.
    residual = float(np.mean(cv2.absdiff(gray, cv2.GaussianBlur(gray, (0, 0), 1.0))))
    # Live faces: sat often ≳ 0.2 and residual ≳ 4. Prints: low sat + softer residual.
    sat_term = max(0.0, min(1.0, 1.0 - sat / 0.22))
    tex_term = max(0.0, min(1.0, 1.0 - residual / 6.0))
    return round(0.65 * sat_term + 0.35 * tex_term, 4)


def _replay_signal(bgr: np.ndarray) -> float:
    """High when artificial horizontal/vertical scan-line stripes are present."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float64)
    # Consecutive-row absolute difference (scan lines alternate).
    row_diff = np.abs(np.diff(gray, axis=0)).mean(axis=1)
    if row_diff.size < 32:
        return 0.0
    centered = row_diff - row_diff.mean()
    spec = np.abs(np.fft.rfft(centered))
    freqs = np.fft.rfftfreq(centered.size)
    # Stripe overlays sit in a mid/high band; ignore very low face-structure freqs.
    band = (freqs >= 0.08) & (freqs <= 0.45)
    if not np.any(band):
        return 0.0
    band_energy = float(np.sum(spec[band]))
    total = float(np.sum(spec[1:])) + 1e-6
    ratio = band_energy / total
    # Also reward strong lag-1 oscillation (every-other-row stripes).
    # Alternating row brightness (classic LCD capture artifact).
    even = float(np.mean(gray[0::2]))
    odd = float(np.mean(gray[1::2]))
    alt = abs(even - odd)
    alt_term = max(0.0, min(1.0, (alt - 8.0) / 40.0))
    lag1 = float(np.mean(row_diff[0::2]) - np.mean(row_diff[1::2]))
    lag_term = max(0.0, min(1.0, abs(lag1) / 10.0))
    ratio_term = max(0.0, min(1.0, (ratio - 0.40) / 0.30))
    return round(max(ratio_term, lag_term, alt_term), 4)


def pad_analyze(face_bgr: np.ndarray) -> tuple[float, PadHint, float, float]:
    """Return (pad_score, hint, print_signal, replay_signal). Score 0 spoof → 1 live."""
    print_s = _print_signal(face_bgr)
    replay_s = _replay_signal(face_bgr)
    attack = max(print_s, replay_s)
    score = round(max(0.0, min(1.0, 1.0 - attack)), 4)
    if replay_s >= print_s and replay_s >= 0.40:
        hint: PadHint = "replay"
    elif print_s >= 0.40:
        hint = "print"
    else:
        hint = "live"
    return score, hint, print_s, replay_s


def pad_reject_reason(
    face_bgr: np.ndarray,
    settings: Settings,
) -> tuple[str | None, float]:
    """If PAD fails, return (reason, score); else (None, score)."""
    if not settings.pad_enabled:
        return None, 1.0
    score, hint, _print_s, _replay_s = pad_analyze(face_bgr)
    if score >= settings.pad_min_score:
        return None, score
    if hint == "replay":
        return f"pad_replay:{score}<{settings.pad_min_score}", score
    if hint == "print":
        return f"pad_print:{score}<{settings.pad_min_score}", score
    return f"pad_fail:{score}<{settings.pad_min_score}", score


__all__ = [
    "pad_analyze",
    "pad_reject_reason",
]
