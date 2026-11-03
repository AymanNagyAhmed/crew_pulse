from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
import logging

from fastapi import FastAPI

from app.api import api_router
from app.core.settings import get_settings
from app.services.detection import warm_models

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    from app.core import runtime

    settings = get_settings()
    try:
        warm_models(settings)
    except Exception:  # noqa: BLE001
        logger.exception("model warm-up failed; /ready will stay not_ready")
        runtime.models_ready = False
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(api_router)
    return app


app = create_app()
