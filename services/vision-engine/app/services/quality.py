"""Capture quality gates (size, luminance, blur, yaw/pitch) before embed."""

from __future__ import annotations

from typing import Any

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


def estimate_yaw_pitch_deg(
    face_bgr: np.ndarray,
    facial_area: dict[str, Any] | None = None,
) -> tuple[float, float]:
    """Heuristic yaw/pitch (degrees). Prefer eye landmarks when the detector provides them."""
    area = facial_area or {}
    left_eye = area.get("left_eye")
    right_eye = area.get("right_eye")
    h, w = face_bgr.shape[:2]

    if (
        isinstance(left_eye, (list, tuple))
        and isinstance(right_eye, (list, tuple))
        and len(left_eye) >= 2
        and len(right_eye) >= 2
        and w > 0
        and h > 0
    ):
        # Eyes in full-frame coords → normalize into the face crop when possible.
        fx = float(area.get("x", 0))
        fy = float(area.get("y", 0))
        lx = (float(left_eye[0]) - fx) / max(w, 1)
        ly = (float(left_eye[1]) - fy) / max(h, 1)
        rx = (float(right_eye[0]) - fx) / max(w, 1)
        ry = (float(right_eye[1]) - fy) / max(h, 1)
        mid_x = (lx + rx) / 2.0
        mid_y = (ly + ry) / 2.0
        # Frontal eyes sit near horizontal mid; shift → yaw. Vertical drift → pitch.
        yaw = (mid_x - 0.5) * 90.0
        pitch = (0.38 - mid_y) * 90.0
        return round(float(yaw), 2), round(float(pitch), 2)

    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    left = gray[:, : max(1, w // 2)]
    right = gray[:, w // 2 :]
    left_e = float(np.mean(cv2.Canny(left, 50, 150)))
    right_e = float(np.mean(cv2.Canny(right, 50, 150)))
    # Profile crops concentrate edges on one side.
    denom = left_e + right_e + 1e-6
    asymmetry = (right_e - left_e) / denom
    yaw = float(np.clip(asymmetry * 70.0, -60.0, 60.0))

    upper = gray[: max(1, h // 2), :]
    lower = gray[h // 2 :, :]
    upper_e = float(np.mean(cv2.Canny(upper, 50, 150)))
    lower_e = float(np.mean(cv2.Canny(lower, 50, 150)))
    # Blank lower band (mask/PPE) is an occlusion problem, not pitch — leave pitch 0.
    edge_floor = 1.5
    if upper_e < edge_floor or lower_e < edge_floor:
        pitch = 0.0
    else:
        vert = (lower_e - upper_e) / (lower_e + upper_e + 1e-6)
        pitch = float(np.clip(vert * 50.0, -50.0, 50.0))
    return round(yaw, 2), round(pitch, 2)


def face_quality_from_bgr(
    face_bgr: np.ndarray,
    facial_area: dict[str, Any] | None = None,
) -> FaceQuality:
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    yaw_deg, pitch_deg = estimate_yaw_pitch_deg(face_bgr, facial_area)
    return FaceQuality(
        blur=estimate_blur(gray),
        luminance=estimate_luminance(gray),
        face_size_px=min(h, w),
        yaw_deg=yaw_deg,
        pitch_deg=pitch_deg,
    )


def quality_reject_reason(quality: FaceQuality, settings: Settings) -> str | None:
    """First failing gate — coachable codes for edge framing feedback."""
    if quality.face_size_px < settings.face_min_size_px:
        return f"face_too_small:{quality.face_size_px}<{settings.face_min_size_px}"
    if quality.luminance < settings.face_min_luminance:
        return f"face_too_dark:{quality.luminance}<{settings.face_min_luminance}"
    if quality.luminance > settings.face_max_luminance:
        return f"face_too_bright:{quality.luminance}>{settings.face_max_luminance}"
    if quality.blur > settings.face_max_blur:
        return f"face_too_blurry:{quality.blur}>{settings.face_max_blur}"
    if abs(quality.yaw_deg) > settings.face_max_yaw_deg:
        return f"face_yaw_too_extreme:{quality.yaw_deg}>±{settings.face_max_yaw_deg}"
    if abs(quality.pitch_deg) > settings.face_max_pitch_deg:
        return (
            f"face_pitch_too_extreme:{quality.pitch_deg}>±{settings.face_max_pitch_deg}"
        )
    return None


def reject_code(reason: str) -> str:
    """Stable coachable code prefix before the ':' detail suffix."""
    return reason.split(":", 1)[0]
