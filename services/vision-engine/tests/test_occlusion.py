"""C5: heavy PPE/mask occlusion signals assisted fallback (not silent reject)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import pytest

from app.core.settings import Settings
from app.schemas.vision import DetectRequest, DetectResponse, MatchRequest
from app.services.detection import DetectionService
from app.services.matching import MatchingService
from app.services.occlusion import occlusion_analyze, occlusion_reject_reason
from app.services.pad import pad_reject_reason
from app.services.quality import (
    face_quality_from_bgr,
    quality_reject_reason,
    reject_code,
)

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
def occ_settings() -> Settings:
    return Settings(
        vision_stub=False,
        occlusion_enabled=True,
        occlusion_max_score=0.55,
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


def test_fixture_mask_fails_occlusion(occ_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_occluded_mask.jpg"))
    assert img is not None
    q = face_quality_from_bgr(img)
    assert quality_reject_reason(q, occ_settings) is None
    pad_reason, _ = pad_reject_reason(img, occ_settings)
    assert pad_reason is None
    reason, score = occlusion_reject_reason(img, occ_settings)
    assert reason is not None
    assert reject_code(reason) in {"face_occluded", "ppe_occlusion"}
    assert score >= occ_settings.occlusion_max_score
    _score, hint = occlusion_analyze(img)
    assert hint in {"mask", "ppe"}


def test_sample_face_passes_occlusion(occ_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "sample_face.jpg"))
    assert img is not None
    h, w = img.shape[:2]
    face = cv2.resize(img[h // 8 : h * 7 // 8, w // 8 : w * 7 // 8], (160, 180))
    reason, score = occlusion_reject_reason(face, occ_settings)
    assert reason is None
    assert score < occ_settings.occlusion_max_score


def test_detect_rejects_mask_before_embed(occ_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_occluded_mask.jpg"))
    assert img is not None
    mock_df = MagicMock()
    mock_df.extract_faces.return_value = _extracted_face(img)

    with (
        patch("app.services.detection.decode_image_base64", return_value=img),
        patch.dict("sys.modules", {"deepface": MagicMock(DeepFace=mock_df)}),
    ):
        result = DetectionService(settings=occ_settings).detect(
            DetectRequest(image_base64="fake")
        )

    assert result.faces == []
    assert any(r in {"face_occluded", "ppe_occlusion"} for r in result.reject_reasons)
    mock_df.represent.assert_not_called()


def test_match_routes_occlusion_to_assisted_fallback() -> None:
    detection = MagicMock()
    detection.detect.return_value = DetectResponse(
        faces=[],
        model_version="test",
        stub=False,
        reject_reasons=["face_occluded"],
    )
    out = MatchingService(detection=detection).match(
        MatchRequest(image_base64="x", venue_id="ven", shift_id="shf")
    )
    assert out.decision == "assisted_fallback"
    assert out.candidates == []
    assert out.face is None
    assert out.reject_reasons == ["face_occluded"]


def test_occlusion_disabled_skips_gate(occ_settings: Settings) -> None:
    img = cv2.imread(str(FIX / "face_occluded_mask.jpg"))
    assert img is not None
    occ_settings.occlusion_enabled = False
    reason, score = occlusion_reject_reason(img, occ_settings)
    assert reason is None
    assert score == 0.0
