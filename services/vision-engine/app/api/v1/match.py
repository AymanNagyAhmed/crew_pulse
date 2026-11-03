from fastapi import APIRouter

from app.schemas.vision import MatchRequest, MatchResponse
from app.services.matching import MatchingService

router = APIRouter(tags=["vision"])
_matching = MatchingService()


@router.post(
    "/match",
    response_model=MatchResponse,
    summary="1:N face match against venue/shift roster (stub scores until 3.3)",
    operation_id="vision.match",
)
def match_faces(body: MatchRequest) -> MatchResponse:
    return _matching.match(body)
