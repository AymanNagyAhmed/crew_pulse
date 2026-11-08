"""C3: PAD / liveness rejects print & replay before embed; match fails closed."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import pytest

from app.core.settings import Settings
from app.schemas.vision import DetectRequest, DetectResponse, MatchRequest
from app.services.detection import DetectionService
from app.services.matching import MatchingService
from app.services.pad import pad_analyze, pad_reject_reason
from app.services.quality import (
    face_quality_from_bgr,
    quality_reject_reason,
    reject_code,
)

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
def pad_settings() -> Settings:
    return Settings(
        vision_stub=False,
        pad_enabled=True,
        pad_min_score=0.45,
        face_min_size_px=80,
        face_max_blur=0.65,
        face_min_luminance=0.15,
        face_max_luminance=0.92,
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


def test_fixture_print_fails_pad(pad_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_pad_print.jpg"))
    assert img is not None
    # Quality must pass so PAD is the failing stage.
    q = face_quality_from_bgr(img)
    assert quality_reject_reason(q, pad_settings) is None
    reason, score = pad_reject_reason(img, pad_settings)
    assert reason is not None
    assert reject_code(reason) == "pad_print"
    assert score < pad_settings.pad_min_score
    _score, hint, *_ = pad_analyze(img)
    assert hint == "print"


def test_fixture_replay_fails_pad(pad_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_pad_replay.jpg"))
    assert img is not None
    q = face_quality_from_bgr(img)
    assert quality_reject_reason(q, pad_settings) is None
    reason, score = pad_reject_reason(img, pad_settings)
    assert reason is not None
    assert reject_code(reason) == "pad_replay"
    assert score < pad_settings.pad_min_score
    _score, hint, *_ = pad_analyze(img)
    assert hint == "replay"


def test_sample_face_passes_pad(pad_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "sample_face.jpg"))
    assert img is not None
    h, w = img.shape[:2]
    face = cv2.resize(img[h // 8 : h * 7 // 8, w // 8 : w * 7 // 8], (160, 180))
    reason, score = pad_reject_reason(face, pad_settings)
    assert reason is None
    assert score >= pad_settings.pad_min_score


def test_detect_rejects_print_before_embed(pad_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_pad_print.jpg"))
    assert img is not None
    mock_df = MagicMock()
    mock_df.extract_faces.return_value = _extracted_face(img)

    with (
        patch("app.services.detection.decode_image_base64", return_value=img),
        patch.dict("sys.modules", {"deepface": MagicMock(DeepFace=mock_df)}),
    ):
        result = DetectionService(settings=pad_settings).detect(
            DetectRequest(image_base64="fake")
        )

    assert result.faces == []
    assert "pad_print" in result.reject_reasons
    mock_df.represent.assert_not_called()


def test_detect_rejects_replay_before_embed(pad_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_pad_replay.jpg"))
    assert img is not None
    mock_df = MagicMock()
    mock_df.extract_faces.return_value = _extracted_face(img)

    with (
        patch("app.services.detection.decode_image_base64", return_value=img),
        patch.dict("sys.modules", {"deepface": MagicMock(DeepFace=mock_df)}),
    ):
        result = DetectionService(settings=pad_settings).detect(
            DetectRequest(image_base64="fake")
        )

    assert result.faces == []
    assert "pad_replay" in result.reject_reasons
    mock_df.represent.assert_not_called()


def test_match_skips_when_pad_rejects() -> None:
    detection = MagicMock()
    detection.detect.return_value = DetectResponse(
        faces=[],
        model_version="test",
        stub=False,
        reject_reasons=["pad_print"],
    )
    out = MatchingService(detection=detection).match(
        MatchRequest(image_base64="x", venue_id="ven", shift_id="shf")
    )
    assert out.decision == "no_match"
    assert out.candidates == []
    assert out.face is None
    assert out.reject_reasons == ["pad_print"]


def test_pad_disabled_always_passes(pad_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_pad_print.jpg"))
    assert img is not None
    pad_settings.pad_enabled = False
    reason, score = pad_reject_reason(img, pad_settings)
    assert reason is None
    assert score == 1.0
