"""KnowledgeStore shim re-exporting from app.services.storage_service."""

from app.services.storage_service import KnowledgeStore, StoreError, SupabaseKnowledgeStore

__all__ = ["KnowledgeStore", "StoreError", "SupabaseKnowledgeStore"]
