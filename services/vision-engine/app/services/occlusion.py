"""Facial occlusion / PPE-mask heuristics before embed.

Stub signals for heavy lower-face coverage (surgical masks, shields fogging as
solid bands). Swap scoring later for a masked-face model without changing
reject codes or gate placement.
"""

from __future__ import annotations

from typing import Literal

import cv2
import numpy as np

from app.core.settings import Settings

OcclusionHint = Literal["clear", "mask", "ppe"]


def occlusion_analyze(face_bgr: np.ndarray) -> tuple[float, OcclusionHint]:
    """Return (occlusion_score, hint). Score 0 clear → 1 heavily occluded."""
    h, w = face_bgr.shape[:2]
    if h < 24 or w < 24:
        return 0.0, "clear"

    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    upper = gray[0 : int(h * 0.42)]
    lower = gray[int(h * 0.52) :]
    if upper.size == 0 or lower.size == 0:
        return 0.0, "clear"

    upper_edges = float(np.mean(cv2.Canny(upper, 60, 140))) / 255.0
    lower_edges = float(np.mean(cv2.Canny(lower, 60, 140))) / 255.0
    # Masked mouths lose mid-face edges relative to the periocular band.
    edge_ratio = lower_edges / (upper_edges + 1e-6)
    edge_term = max(0.0, min(1.0, 1.0 - edge_ratio / 0.55))

    lower_std = float(np.std(lower)) / 255.0
    # Solid PPE fabric / shield bands are low-variance vs skin texture.
    flat_term = max(0.0, min(1.0, 1.0 - lower_std / 0.12))

    # Color uniformity on lower third (blue/white surgical masks).
    lower_bgr = face_bgr[int(h * 0.52) :]
    channel_std = float(np.mean(np.std(lower_bgr.reshape(-1, 3), axis=0))) / 255.0
    chroma_term = max(0.0, min(1.0, 1.0 - channel_std / 0.10))

    score = round(
        max(0.0, min(1.0, 0.45 * edge_term + 0.35 * flat_term + 0.20 * chroma_term)),
        4,
    )
    if score >= 0.55:
        hint: OcclusionHint = "mask" if chroma_term >= flat_term else "ppe"
    else:
        hint = "clear"
    return score, hint


def occlusion_reject_reason(
    face_bgr: np.ndarray,
    settings: Settings,
) -> tuple[str | None, float]:
    """If occlusion is too heavy for biometric match, return (reason, score)."""
    if not settings.occlusion_enabled:
        return None, 0.0
    score, hint = occlusion_analyze(face_bgr)
    if score < settings.occlusion_max_score:
        return None, score
    if hint == "ppe":
        return f"ppe_occlusion:{score}>={settings.occlusion_max_score}", score
    return f"face_occluded:{score}>={settings.occlusion_max_score}", score


__all__ = [
    "occlusion_analyze",
    "occlusion_reject_reason",
]
