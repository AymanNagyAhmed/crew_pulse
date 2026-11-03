"""1:N match stubs — gallery search stays scoped; no raw embeddings in responses."""

from __future__ import annotations

from typing import Literal

from app.schemas.vision import DetectRequest, MatchCandidate, MatchRequest, MatchResponse
from app.services.detection import STUB_MODEL_VERSION, DetectionService

# Align with future api-gateway attendance policy defaults.
STUB_MATCH_THRESHOLD = 0.75

MatchDecision = Literal["matched", "no_match", "needs_review"]


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
            model_version=STUB_MODEL_VERSION,
            stub=True,
        )
