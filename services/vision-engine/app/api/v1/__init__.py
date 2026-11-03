from fastapi import APIRouter

from app.api.v1.detect import router as detect_router
from app.api.v1.match import router as match_router

v1_router = APIRouter(prefix="/v1")
v1_router.include_router(detect_router)
v1_router.include_router(match_router)
