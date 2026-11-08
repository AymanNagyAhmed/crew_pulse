"""Capture quality gates (blur, face size, luminance) before embed."""

from __future__ import annotations

import cv2
import numpy as np

from app.core.settings import Settings
from app.schemas.vision import FaceQuality


def estimate_blur(gray: np.ndarray) -> float:
    """Map Laplacian variance to 0 (sharp) … 1 (blurry)."""
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # Empirically: <50 very blurry, >500 sharp for typical webcam crops.
    sharp = min(1.0, variance / 500.0)
    return round(1.0 - sharp, 4)


def estimate_luminance(gray: np.ndarray) -> float:
    return round(float(np.mean(gray)) / 255.0, 4)


def face_quality_from_bgr(face_bgr: np.ndarray) -> FaceQuality:
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    return FaceQuality(
        blur=estimate_blur(gray),
        luminance=estimate_luminance(gray),
        face_size_px=min(h, w),
        yaw_deg=0.0,
        pitch_deg=0.0,
    )


def quality_reject_reason(quality: FaceQuality, settings: Settings) -> str | None:
    """Return the first failing gate. Lighting (luminance) before blur for coachable SOP."""
    if quality.face_size_px < settings.face_min_size_px:
        return f"face_too_small:{quality.face_size_px}<{settings.face_min_size_px}"
    if quality.luminance < settings.face_min_luminance:
        return f"face_too_dark:{quality.luminance}<{settings.face_min_luminance}"
    if quality.luminance > settings.face_max_luminance:
        return f"face_too_bright:{quality.luminance}>{settings.face_max_luminance}"
    if quality.blur > settings.face_max_blur:
        return f"face_too_blurry:{quality.blur}>{settings.face_max_blur}"
    return None


def reject_code(reason: str) -> str:
    """Stable coachable code prefix before the ':' detail suffix."""
    return reason.split(":", 1)[0]
