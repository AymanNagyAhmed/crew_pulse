"""1:N match — real detect + stub scores; production gallery ANN is api-gateway/pgvector (C4)."""

from __future__ import annotations

from typing import Literal

from app.core.settings import get_settings
from app.schemas.vision import DetectRequest, MatchCandidate, MatchRequest, MatchResponse
from app.services.detection import DetectionService

STUB_MATCH_THRESHOLD = 0.75

MatchDecision = Literal["matched", "no_match", "needs_review", "assisted_fallback"]

# Heavy PPE/mask → assisted PIN/QR; never treat as a silent biometric miss.
_ASSISTED_REJECT_CODES = frozenset({"face_occluded", "ppe_occlusion"})


class MatchingService:
    def __init__(self, detection: DetectionService | None = None) -> None:
        self._detection = detection or DetectionService()

    def match(self, payload: MatchRequest) -> MatchResponse:
        detect = self._detection.detect(
            DetectRequest(
                image_base64=payload.image_base64,
                venue_id=payload.venue_id,
            )
        )
        primary = detect.faces[0] if detect.faces else None

        if primary is None:
            reasons = list(detect.reject_reasons)
            decision: MatchDecision = (
                "assisted_fallback"
                if _ASSISTED_REJECT_CODES.intersection(reasons)
                else "no_match"
            )
            return MatchResponse(
                decision=decision,
                best_score=0.0,
                threshold=STUB_MATCH_THRESHOLD,
                candidates=[],
                face=None,
                model_version=detect.model_version,
                stub=detect.stub,
                reject_reasons=reasons,
            )

        worker_ids = payload.candidate_worker_ids or ["worker_stub_001"]
        candidates = [
            MatchCandidate(worker_id=wid, score=max(0.0, 0.91 - (i * 0.05)))
            for i, wid in enumerate(worker_ids[: payload.top_k])
        ]
        best = candidates[0].score if candidates else 0.0

        decision: MatchDecision
        if best >= STUB_MATCH_THRESHOLD:
            decision = "matched"
        elif best >= STUB_MATCH_THRESHOLD - 0.1:
            decision = "needs_review"
        else:
            decision = "no_match"

        return MatchResponse(
            decision=decision,
            best_score=best,
            threshold=STUB_MATCH_THRESHOLD,
            candidates=candidates,
            face=primary,
            model_version=detect.model_version,
            stub=detect.stub or get_settings().vision_stub,
            reject_reasons=[],
        )
