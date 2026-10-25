"""Persistent roadmap storage service.

Attempts to save and load study maps from Supabase PostgreSQL (table `study_maps`).
If the table is not yet created in Supabase, automatically falls back to persistent
server-side JSON storage per user ID, ensuring maps are never lost when the tab closes.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings
from app.core.security import User

log = logging.getLogger("organizer.services.map_storage")

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage" / "user_maps"


class MapStorageService:
    def __init__(self) -> None:
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    def _headers(self, user: User) -> dict[str, str]:
        return {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {user.token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    # ---- Local File Fallback Storage Helpers ----

    def _file_path(self, user: User) -> Path:
        safe_uid = "".join(c for c in user.id if c.isalnum() or c in ("-", "_"))
        return STORAGE_DIR / f"{safe_uid}.json"

    def _read_local(self, user: User) -> list[dict[str, Any]]:
        path = self._file_path(user)
        if not path.exists():
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception as e:
            log.warning("Failed reading fallback map storage for user %s: %s", user.id, e)
            return []

    def _write_local(self, user: User, maps: list[dict[str, Any]]) -> None:
        path = self._file_path(user)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(maps, f, indent=2)
        except Exception as e:
            log.warning("Failed writing fallback map storage for user %s: %s", user.id, e)

    # ---- Public API Methods ----

    def get_maps(self, user: User) -> list[dict[str, Any]]:
        """Fetch all roadmaps for the authenticated user."""
        url = f"{settings.supabase_url}/rest/v1/study_maps?select=*&order=updated_at.desc"
        try:
            with httpx.Client(timeout=10) as client:
                res = client.get(url, headers=self._headers(user))
                if res.status_code == 200:
                    rows = res.json()
                    # Normalize Supabase column names to match frontend expectations
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
                if res.status_code in (404, 400):
                    log.info("Supabase study_maps table not ready (code %s); using server file persistence.", res.status_code)
        except Exception as e:
            log.warning("Could not reach Supabase for maps: %s", e)

        # Fallback to local server persistence
        return self._read_local(user)

    def save_map(self, user: User, map_data: dict[str, Any]) -> dict[str, Any]:
        """Upsert a roadmap for the authenticated user."""
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

        # Try Supabase PostgREST upsert
        url = f"{settings.supabase_url}/rest/v1/study_maps"
        headers = {
            **self._headers(user),
            "Prefer": "resolution=merge-duplicates,return=representation",
        }
        try:
            with httpx.Client(timeout=10) as client:
                res = client.post(url, headers=headers, json=[payload])
                if res.status_code in (200, 201):
                    log.info("Map %s successfully persisted to Supabase.", map_id)
        except Exception as e:
            log.warning("Could not upsert map to Supabase: %s", e)

        # Always update local server persistence so maps are instantly available even offline
        existing = self._read_local(user)
        idx = next((i for i, m in enumerate(existing) if m.get("id") == map_id), -1)
        normalized = {
            "id": map_id,
            "title": payload["title"],
            "folderId": payload["folder_id"],
            "nodes": payload["nodes"],
            "createdAt": map_data.get("createdAt") or map_data.get("updatedAt") or "now()",
            "updatedAt": map_data.get("updatedAt") or "now()",
        }
        if idx >= 0:
            existing[idx] = normalized
        else:
            existing.insert(0, normalized)
        self._write_local(user, existing)

        return normalized

    def delete_map(self, user: User, map_id: str) -> bool:
        """Delete a roadmap for the authenticated user."""
        url = f"{settings.supabase_url}/rest/v1/study_maps?id=eq.{map_id}"
        try:
            with httpx.Client(timeout=10) as client:
                client.delete(url, headers=self._headers(user))
        except Exception as e:
            log.warning("Could not delete map in Supabase: %s", e)

        # Update local server persistence
        existing = self._read_local(user)
        filtered = [m for m in existing if m.get("id") != map_id]
        self._write_local(user, filtered)
        return True
