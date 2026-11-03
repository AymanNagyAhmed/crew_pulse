from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.core import runtime
from app.core.settings import get_settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness probe",
)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", service=settings.app_name)


@router.get(
    "/ready",
    response_model=HealthResponse,
    summary="Readiness probe (fails if models failed to load)",
    responses={503: {"model": HealthResponse}},
)
def ready() -> HealthResponse | JSONResponse:
    settings = get_settings()
    if not runtime.models_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=HealthResponse(
                status="not_ready",
                service=settings.app_name,
            ).model_dump(),
        )
    return HealthResponse(status="ok", service=settings.app_name)
