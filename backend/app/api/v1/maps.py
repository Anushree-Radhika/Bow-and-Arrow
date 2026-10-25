from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import User, current_user
from app.services.map_storage_service import MapStorageService

router = APIRouter(prefix="/api/maps", tags=["maps"])
_storage = MapStorageService()


def get_map_storage() -> MapStorageService:
    return _storage


@router.get("", response_model=list[dict[str, Any]])
def list_maps(
    user: User = Depends(current_user),
    storage: MapStorageService = Depends(get_map_storage),
):
    """Retrieve all saved roadmaps for the authenticated user from the database."""
    return storage.get_maps(user)


@router.post("", response_model=dict[str, Any])
def save_map(
    body: dict[str, Any],
    user: User = Depends(current_user),
    storage: MapStorageService = Depends(get_map_storage),
):
    """Save or update a roadmap in persistent cloud/server storage."""
    if not body.get("id"):
        raise HTTPException(422, "Map must include an 'id'.")
    return storage.save_map(user, body)


@router.delete("/{map_id}")
def delete_map(
    map_id: str,
    user: User = Depends(current_user),
    storage: MapStorageService = Depends(get_map_storage),
):
    """Delete a roadmap from persistent storage."""
    storage.delete_map(user, map_id)
    return {"status": "ok", "deleted": map_id}
