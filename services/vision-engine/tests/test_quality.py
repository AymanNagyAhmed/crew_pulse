"""C2: luminance / quality gates reject before embed."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
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
def gate_settings() -> Settings:
    return Settings(
        vision_stub=False,
        face_min_size_px=80,
        face_max_blur=0.65,
        face_min_luminance=0.15,
        face_max_luminance=0.92,
    )


def test_fixture_too_dark_rejected(gate_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_too_dark.jpg"))
    assert img is not None
    quality = face_quality_from_bgr(img)
    reason = quality_reject_reason(quality, gate_settings)
    assert reason is not None
    assert reject_code(reason) == "face_too_dark"
    assert quality.luminance < gate_settings.face_min_luminance


def test_fixture_too_bright_rejected(gate_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_too_bright.jpg"))
    assert img is not None
    quality = face_quality_from_bgr(img)
    reason = quality_reject_reason(quality, gate_settings)
    assert reason is not None
    assert reject_code(reason) == "face_too_bright"
    assert quality.luminance > gate_settings.face_max_luminance


def test_mid_luminance_passes(gate_settings: Settings) -> None:
    # Checkerboard keeps Laplacian variance high (sharp) at mid luminance.
    face = np.zeros((160, 160, 3), dtype=np.uint8)
    face[0:160:2, 0:160:2] = 150
    face[1:160:2, 1:160:2] = 110
    quality = face_quality_from_bgr(face)
    assert 0.15 <= quality.luminance <= 0.92
    assert quality.blur <= gate_settings.face_max_blur
    assert quality_reject_reason(quality, gate_settings) is None


def test_synthetic_array_dark_and_bright(gate_settings: Settings) -> None:
    dark = np.full((120, 120, 3), 8, dtype=np.uint8)
    bright = np.full((120, 120, 3), 250, dtype=np.uint8)
    assert reject_code(
        quality_reject_reason(face_quality_from_bgr(dark), gate_settings) or ""
    ) == "face_too_dark"
    assert reject_code(
        quality_reject_reason(face_quality_from_bgr(bright), gate_settings) or ""
    ) == "face_too_bright"


def _extracted_face(face_bgr: np.ndarray) -> list[dict]:
    face_rgb = face_bgr[:, :, ::-1]
    h, w = face_bgr.shape[:2]
    return [
        {
            "confidence": 0.99,
            "face": face_rgb,
            "facial_area": {"x": 10, "y": 10, "w": w, "h": h},
        }
    ]


def test_detect_rejects_dark_before_embed(gate_settings: Settings) -> None:
    dark = cv2.imread(str(FIX / "face_too_dark.jpg"))
    assert dark is not None
    mock_df = MagicMock()
    mock_df.extract_faces.return_value = _extracted_face(dark)

    with (
        patch("app.services.detection.decode_image_base64", return_value=dark),
        patch.dict("sys.modules", {"deepface": MagicMock(DeepFace=mock_df)}),
    ):
        service = DetectionService(settings=gate_settings)
        result = service.detect(DetectRequest(image_base64="fake"))

    assert result.faces == []
    assert "face_too_dark" in result.reject_reasons
    mock_df.represent.assert_not_called()


def test_detect_rejects_bright_before_embed(gate_settings: Settings) -> None:
    bright = cv2.imread(str(FIX / "face_too_bright.jpg"))
    assert bright is not None
    mock_df = MagicMock()
    mock_df.extract_faces.return_value = _extracted_face(bright)

    with (
        patch("app.services.detection.decode_image_base64", return_value=bright),
        patch.dict("sys.modules", {"deepface": MagicMock(DeepFace=mock_df)}),
    ):
        service = DetectionService(settings=gate_settings)
        result = service.detect(DetectRequest(image_base64="fake"))

    assert result.faces == []
    assert "face_too_bright" in result.reject_reasons
    mock_df.represent.assert_not_called()


def test_match_propagates_reject_reasons(gate_settings: Settings) -> None:
    from app.schemas.vision import DetectResponse, MatchRequest
    from app.services.matching import MatchingService

    detection = MagicMock()
    detection.detect.return_value = DetectResponse(
        faces=[],
        model_version="test",
        stub=False,
        reject_reasons=["face_too_dark"],
    )
    matching = MatchingService(detection=detection)
    out = matching.match(
        MatchRequest(
            image_base64="x",
            venue_id="ven",
            shift_id="shf",
        )
    )
    assert out.decision == "no_match"
    assert out.reject_reasons == ["face_too_dark"]
    assert out.face is None


def test_reject_code_helper() -> None:
    assert reject_code("face_too_dark:0.05<0.15") == "face_too_dark"
    q = FaceQuality(blur=0.1, luminance=0.5, face_size_px=100, yaw_deg=0, pitch_deg=0)
    assert quality_reject_reason(q, Settings()) is None
