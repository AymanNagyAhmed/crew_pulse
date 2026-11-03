"""Face detection via RetinaFace (DeepFace) with quality gates before embed."""

from __future__ import annotations

import hashlib
import logging
import os
import uuid
from typing import Any

import numpy as np

from app.core.settings import Settings, get_settings
from app.schemas.vision import (
    BoundingBox,
    DetectedFace,
    DetectRequest,
    DetectResponse,
    FaceQuality,
)
from app.services.image_codec import decode_image_base64
from app.services.quality import face_quality_from_bgr, quality_reject_reason

logger = logging.getLogger(__name__)

STUB_MODEL_VERSION = "stub-0.1.0"
STUB_EMBEDDING_DIM = 512
REAL_MODEL_VERSION = "deepface-retinaface-facenet512-0.1.0"


class DetectionService:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings_override = settings

    def _settings(self) -> Settings:
        return self._settings_override or get_settings()

    def detect(self, payload: DetectRequest) -> DetectResponse:
        settings = self._settings()
        if settings.vision_stub:
            return self._stub_detect(payload)

        image = decode_image_base64(payload.image_base64)
        os.environ.setdefault("DEEPFACE_HOME", settings.deepface_home)

        from deepface import DeepFace

        extract_kwargs: dict[str, Any] = {
            "detector_backend": settings.detector_backend,
            "enforce_detection": False,
            "align": True,
        }
        extracted = DeepFace.extract_faces(img_path=image, **extract_kwargs)

        faces: list[DetectedFace] = []
        for item in extracted:
            confidence = float(item.get("confidence") or 0.0)
            if confidence <= 0.0 and item.get("facial_area", {}).get("w", 0) == 0:
                continue

            face_rgb = item["face"]
            if face_rgb.dtype != np.uint8:
                face_bgr = (np.clip(face_rgb, 0, 1) * 255).astype(np.uint8)
                face_bgr = face_bgr[:, :, ::-1]
            else:
                face_bgr = face_rgb[:, :, ::-1]

            quality = face_quality_from_bgr(face_bgr)
            reject = quality_reject_reason(quality, settings)
            if reject is not None:
                logger.info("quality_gate_reject reason=%s", reject)
                continue

            # Embed only after quality gates; discard vector immediately.
            reps = DeepFace.represent(
                img_path=face_bgr,
                model_name=settings.embedding_model,
                detector_backend="skip",
                enforce_detection=False,
            )
            embedding = reps[0]["embedding"]
            embedding_dim = len(embedding)
            del embedding, reps

            area = item.get("facial_area") or {}
            bbox = BoundingBox(
                x=int(area.get("x", 0)),
                y=int(area.get("y", 0)),
                width=max(1, int(area.get("w", quality.face_size_px))),
                height=max(1, int(area.get("h", quality.face_size_px))),
            )
            digest = hashlib.sha256(payload.image_base64.encode("utf-8")).hexdigest()[:12]
            faces.append(
                DetectedFace(
                    face_ref=f"face_{digest}_{uuid.uuid4().hex[:8]}",
                    bbox=bbox,
                    detection_score=min(1.0, max(0.0, confidence or 0.99)),
                    quality=quality,
                    embedding_dim=embedding_dim,
                )
            )

        return DetectResponse(
            faces=faces,
            model_version=REAL_MODEL_VERSION,
            stub=False,
        )

    def _stub_detect(self, payload: DetectRequest) -> DetectResponse:
        digest = hashlib.sha256(payload.image_base64.encode("utf-8")).hexdigest()[:12]
        face = DetectedFace(
            face_ref=f"face_{digest}_{uuid.uuid4().hex[:8]}",
            bbox=BoundingBox(x=100, y=80, width=160, height=180),
            detection_score=0.97,
            quality=FaceQuality(
                blur=0.12,
                luminance=0.55,
                face_size_px=160,
                yaw_deg=5.0,
                pitch_deg=-2.0,
            ),
            embedding_dim=STUB_EMBEDDING_DIM,
        )
        return DetectResponse(
            faces=[face],
            model_version=STUB_MODEL_VERSION,
            stub=True,
        )


def warm_models(settings: Settings | None = None) -> None:
    """Load detector + embedding weights once at startup (documents DEEPFACE_HOME)."""
    from app.core import runtime

    cfg = settings or get_settings()
    if cfg.vision_stub:
        runtime.models_ready = True
        return
    os.environ.setdefault("DEEPFACE_HOME", cfg.deepface_home)
    from deepface import DeepFace

    # Tiny blank probe — forces weight download/load without a real face.
    probe = np.zeros((160, 160, 3), dtype=np.uint8)
    DeepFace.build_model(model_name=cfg.embedding_model)
    try:
        DeepFace.extract_faces(
            img_path=probe,
            detector_backend=cfg.detector_backend,
            enforce_detection=False,
        )
    except Exception:  # noqa: BLE001 — readiness still set if weights exist
        logger.exception("detector warm-up raised; continuing if weights present")
    runtime.models_ready = True
