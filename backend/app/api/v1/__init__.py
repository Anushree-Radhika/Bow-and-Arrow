from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.mindmap import router as mindmap_router
from app.api.v1.maps import router as maps_router

router = APIRouter()
router.include_router(health_router)
router.include_router(mindmap_router)
router.include_router(maps_router)

__all__ = ["router"]
