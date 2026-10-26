from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
def root():
    return {
        "status": "ok",
        "service": "Bow and Arrow API",
        "version": "0.2.0",
        "docs": "/docs",
    }


@router.get("/health")
@router.get("/api/health")
def health():
    return {"status": "ok"}
