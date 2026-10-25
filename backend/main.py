"""Main entrypoint for Organizer Backend.

Re-exports FastAPI app instance from app.main for uvicorn compatibility:
`uvicorn main:app --reload`
"""

from app.main import app

__all__ = ["app"]
