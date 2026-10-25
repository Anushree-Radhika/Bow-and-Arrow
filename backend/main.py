from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.mindmap import router as mindmap_router

app = FastAPI(title="Organizer API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(mindmap_router)


@app.get("/health")
def health():
    return {"status": "ok"}
