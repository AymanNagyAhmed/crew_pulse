"""C6: blur and extreme yaw/pitch rejected before embed with coachable codes."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import pytest

from app.core.settings import Settings
from app.schemas.vision import DetectRequest, FaceQuality
from app.services.detection import DetectionService
from app.services.quality import (
    face_quality_from_bgr,
    quality_reject_reason,
    reject_code,
)

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
def pose_settings() -> Settings:
    return Settings(
        vision_stub=False,
        face_min_size_px=80,
        face_max_blur=0.65,
        face_min_luminance=0.15,
        face_max_luminance=0.92,
        face_max_yaw_deg=25.0,
        face_max_pitch_deg=20.0,
        pad_enabled=False,
        occlusion_enabled=False,
    )


def _extracted_face(face_bgr) -> list[dict]:
    face_rgb = face_bgr[:, :, ::-1]
    h, w = face_bgr.shape[:2]
    return [
        {
            "confidence": 0.99,
            "face": face_rgb,
            "facial_area": {"x": 10, "y": 10, "w": w, "h": h},
        }
    ]


def test_fixture_too_blurry_rejected(pose_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_too_blurry.jpg"))
    assert img is not None
    quality = face_quality_from_bgr(img)
    reason = quality_reject_reason(quality, pose_settings)
    assert reason is not None
    assert reject_code(reason) == "face_too_blurry"
    assert quality.blur > pose_settings.face_max_blur


def test_fixture_yaw_extreme_rejected(pose_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_yaw_extreme.jpg"))
    assert img is not None
    quality = face_quality_from_bgr(img)
    reason = quality_reject_reason(quality, pose_settings)
    assert reason is not None
    assert reject_code(reason) == "face_yaw_too_extreme"
    assert abs(quality.yaw_deg) > pose_settings.face_max_yaw_deg


def test_explicit_yaw_pitch_gate(pose_settings: Settings) -> None:
    quality = FaceQuality(
        blur=0.1,
        luminance=0.5,
        face_size_px=160,
        yaw_deg=40.0,
        pitch_deg=0.0,
    )
    reason = quality_reject_reason(quality, pose_settings)
    assert reject_code(reason or "") == "face_yaw_too_extreme"

    quality.yaw_deg = 0.0
    quality.pitch_deg = 35.0
    reason = quality_reject_reason(quality, pose_settings)
    assert reject_code(reason or "") == "face_pitch_too_extreme"


def test_detect_rejects_blur_before_embed(pose_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_too_blurry.jpg"))
    assert img is not None
    mock_df = MagicMock()
    mock_df.extract_faces.return_value = _extracted_face(img)

    with (
        patch("app.services.detection.decode_image_base64", return_value=img),
        patch.dict("sys.modules", {"deepface": MagicMock(DeepFace=mock_df)}),
    ):
        result = DetectionService(settings=pose_settings).detect(
            DetectRequest(image_base64="fake")
        )

    assert result.faces == []
    assert "face_too_blurry" in result.reject_reasons
    mock_df.represent.assert_not_called()


def test_sample_face_passes_pose_and_blur(pose_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "sample_face.jpg"))
    assert img is not None
    h, w = img.shape[:2]
    face = cv2.resize(img[h // 8 : h * 7 // 8, w // 8 : w * 7 // 8], (160, 180))
    quality = face_quality_from_bgr(face)
    assert quality_reject_reason(quality, pose_settings) is None
