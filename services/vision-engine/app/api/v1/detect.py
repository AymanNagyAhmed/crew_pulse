from fastapi import APIRouter

from app.schemas.vision import DetectRequest, DetectResponse
from app.services.detection import DetectionService

router = APIRouter(tags=["vision"])
_detection = DetectionService()


@router.post(
    "/detect",
    response_model=DetectResponse,
    summary="Detect faces in a probe frame (stub scores until 3.3)",
    operation_id="vision.detect",
)
def detect_faces(body: DetectRequest) -> DetectResponse:
    return _detection.detect(body)
