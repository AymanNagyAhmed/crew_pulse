"""Face detection stubs — real RetinaFace/DeepFace wiring in phase 3.3."""

from __future__ import annotations

import hashlib
import uuid

from app.schemas.vision import (
    BoundingBox,
    DetectedFace,
    DetectRequest,
    DetectResponse,
    FaceQuality,
)

STUB_MODEL_VERSION = "stub-0.1.0"
STUB_EMBEDDING_DIM = 512


class DetectionService:
    def detect(self, payload: DetectRequest) -> DetectResponse:
        # Stable-ish face_ref from image bytes so clients can correlate retries.
        digest = hashlib.sha256(payload.image_base64.encode("utf-8")).hexdigest()[:12]
        face_ref = f"face_{digest}_{uuid.uuid4().hex[:8]}"

        face = DetectedFace(
            face_ref=face_ref,
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
