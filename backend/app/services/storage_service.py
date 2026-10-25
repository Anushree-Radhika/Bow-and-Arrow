"""knowledge_chunks access through Supabase PostgREST, acting as the user."""

from __future__ import annotations

from typing import Protocol
import httpx

from app.core.config import settings
from app.core.security import User


class StoreError(RuntimeError):
    pass


class KnowledgeStore(Protocol):
    def insert_chunks(self, user: User, rows: list[dict]) -> None: ...

    def match(
        self, user: User, embedding: list[float], k: int, min_similarity: float, folder_id: str | None
    ) -> list[dict]: ...


class SupabaseKnowledgeStore:
    def _headers(self, user: User) -> dict[str, str]:
        return {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {user.token}",
            "Content-Type": "application/json",
        }

    def insert_chunks(self, user: User, rows: list[dict]) -> None:
        url = f"{settings.supabase_url}/rest/v1/knowledge_chunks"
        try:
            with httpx.Client(timeout=30) as c:
                for i in range(0, len(rows), 100):
                    r = c.post(url, headers={**self._headers(user), "Prefer": "return=minimal"}, json=rows[i : i + 100])
                    if r.status_code >= 300:
                        raise StoreError(f"insert failed ({r.status_code}): {r.text[:200]}")
        except httpx.HTTPError as e:
            raise StoreError(f"insert failed: {e}") from e

    def match(
        self, user: User, embedding: list[float], k: int, min_similarity: float, folder_id: str | None
    ) -> list[dict]:
        try:
            r = httpx.post(
                f"{settings.supabase_url}/rest/v1/rpc/match_user_knowledge",
                headers=self._headers(user),
                json={
                    "query_embedding": embedding,
                    "match_count": k,
                    "match_threshold": min_similarity,
                    "filter_folder_id": folder_id,
                },
                timeout=30,
            )
        except httpx.HTTPError as e:
            raise StoreError(f"search failed: {e}") from e
        if r.status_code >= 300:
            raise StoreError(f"search failed ({r.status_code}): {r.text[:200]}")
        return r.json()
