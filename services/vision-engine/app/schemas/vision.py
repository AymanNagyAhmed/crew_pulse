from typing import Literal

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Normalized face box in pixel coordinates of the source frame."""

    x: int = Field(ge=0, examples=[120])
    y: int = Field(ge=0, examples=[80])
    width: int = Field(gt=0, examples=[160])
    height: int = Field(gt=0, examples=[180])


class FaceQuality(BaseModel):
    """Capture QA signals for edge coaching and gate decisions (stubs in 3.2)."""

    blur: float = Field(ge=0.0, le=1.0, description="0 sharp → 1 blurry", examples=[0.12])
    luminance: float = Field(
        ge=0.0, le=1.0, description="Mean face luminance", examples=[0.55]
    )
    face_size_px: int = Field(gt=0, examples=[160])
    yaw_deg: float = Field(examples=[5.0])
    pitch_deg: float = Field(examples=[-2.0])


class DetectRequest(BaseModel):
    """Probe frame for detection. Prefer base64 for JSON stubs; multipart later."""

    image_base64: str = Field(
        min_length=1,
        description="Base64-encoded image bytes (no data-URL prefix required)",
        examples=["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="],
    )
    venue_id: str | None = Field(
        default=None, description="Optional venue context for logging/metrics"
    )


class DetectedFace(BaseModel):
    face_ref: str = Field(
        description="Opaque face token for this request; not a biometric template"
    )
    bbox: BoundingBox
    detection_score: float = Field(ge=0.0, le=1.0, examples=[0.97])
    quality: FaceQuality
    embedding_dim: int = Field(
        gt=0,
        description="Embedding length only — raw vectors are never returned",
        examples=[512],
    )


class DetectResponse(BaseModel):
    faces: list[DetectedFace]
    model_version: str = Field(examples=["stub-0.1.0"])
    stub: bool = Field(default=True, description="True until real models ship in 3.3")
    reject_reasons: list[str] = Field(
        default_factory=list,
        description=(
            "Coachable quality-gate codes when faces were found but rejected "
            "before embed (e.g. face_too_dark, face_too_bright). Empty when none."
        ),
        examples=[["face_too_dark"]],
    )


class MatchRequest(BaseModel):
    """1:N match scoped to a venue/shift roster (gallery lives in api-gateway/DB)."""

    image_base64: str = Field(min_length=1)
    venue_id: str = Field(min_length=1, examples=["venue_demo"])
    shift_id: str = Field(min_length=1, examples=["shift_morning"])
    top_k: int = Field(default=5, ge=1, le=20)
    # Optional: gateway may pass eligible worker ids once roster filtering exists.
    candidate_worker_ids: list[str] | None = None


class MatchCandidate(BaseModel):
    worker_id: str = Field(examples=["worker_stub_001"])
    score: float = Field(
        ge=0.0, le=1.0, description="Similarity score (stub)", examples=[0.91]
    )


class MatchResponse(BaseModel):
    decision: Literal["matched", "no_match", "needs_review"]
    best_score: float = Field(ge=0.0, le=1.0)
    threshold: float = Field(ge=0.0, le=1.0, examples=[0.75])
    candidates: list[MatchCandidate]
    face: DetectedFace | None = Field(
        default=None, description="Primary face used for match, if any"
    )
    model_version: str = Field(examples=["stub-0.1.0"])
    stub: bool = True
    reject_reasons: list[str] = Field(
        default_factory=list,
        description="Propagated from detect quality gates; coach capture, do not force match",
        examples=[["face_too_dark"]],
    )
