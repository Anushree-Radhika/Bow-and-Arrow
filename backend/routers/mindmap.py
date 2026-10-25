"""Mindmap router shim re-exporting from app.api.v1.mindmap."""

from app.api.v1.mindmap import get_ai, get_store, router

__all__ = ["get_ai", "get_store", "router"]
