"""Supabase cloud roadmap storage service.

All study maps, nodes, and progress are stored directly in Supabase (table `study_maps`)
under the authenticated user's account with Row-Level Security.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.security import User

log = logging.getLogger("organizer.services.map_storage")


class MapStorageService:
    def _headers(self, user: User) -> dict[str, str]:
        return {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {user.token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def get_maps(self, user: User) -> list[dict[str, Any]]:
        """Fetch all roadmaps for the authenticated user from Supabase."""
        url = f"{settings.supabase_url}/rest/v1/study_maps?select=*&order=updated_at.desc"
        try:
            with httpx.Client(timeout=10) as client:
                res = client.get(url, headers=self._headers(user))
                if res.status_code == 200:
                    rows = res.json()
                    return [
                        {
                            "id": r["id"],
                            "title": r["title"],
                            "folderId": r.get("folder_id"),
                            "nodes": r.get("nodes", []),
                            "createdAt": r.get("created_at"),
                            "updatedAt": r.get("updated_at"),
                        }
                        for r in rows
                    ]
                log.warning("Supabase get_maps returned status %s: %s", res.status_code, res.text[:200])
        except Exception as e:
            log.warning("Could not fetch maps from Supabase: %s", e)

        return []

    def save_map(self, user: User, map_data: dict[str, Any]) -> dict[str, Any]:
        """Upsert a roadmap for the authenticated user into Supabase."""
        map_id = str(map_data.get("id"))
        if not map_id:
            raise ValueError("Map missing 'id'.")

        folder_id = map_data.get("folderId")
        if folder_id and not isinstance(folder_id, str):
            folder_id = str(folder_id)
        if not folder_id or not folder_id.strip():
            folder_id = None

        payload = {
            "id": map_id,
            "user_id": user.id,
            "title": str(map_data.get("title", "Untitled Map"))[:200],
            "folder_id": folder_id,
            "nodes": map_data.get("nodes", []),
            "updated_at": "now()",
        }

        url = f"{settings.supabase_url}/rest/v1/study_maps?on_conflict=id"
        headers = {
            **self._headers(user),
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        try:
            with httpx.Client(timeout=10) as client:
                res = client.post(url, headers=headers, json=[payload])
                if res.status_code in (200, 201):
                    log.info("Map %s successfully persisted to Supabase.", map_id)
                    data = res.json()
                    if isinstance(data, list) and data:
                        r = data[0]
                        return {
                            "id": r["id"],
                            "title": r["title"],
                            "folderId": r.get("folder_id"),
                            "nodes": r.get("nodes", []),
                            "createdAt": r.get("created_at"),
                            "updatedAt": r.get("updated_at"),
                        }
                else:
                    log.warning("Supabase save_map returned status %s: %s", res.status_code, res.text[:200])
        except Exception as e:
            log.warning("Could not upsert map to Supabase: %s", e)

        return {
            "id": map_id,
            "title": payload["title"],
            "folderId": payload["folder_id"],
            "nodes": payload["nodes"],
            "createdAt": map_data.get("createdAt") or map_data.get("updatedAt") or "now()",
            "updatedAt": map_data.get("updatedAt") or "now()",
        }

    def delete_map(self, user: User, map_id: str) -> bool:
        """Delete a roadmap for the authenticated user from Supabase."""
        url = f"{settings.supabase_url}/rest/v1/study_maps?id=eq.{map_id}"
        try:
            with httpx.Client(timeout=10) as client:
                res = client.delete(url, headers=self._headers(user))
                return res.status_code in (200, 204)
        except Exception as e:
            log.warning("Could not delete map in Supabase: %s", e)
            return False

