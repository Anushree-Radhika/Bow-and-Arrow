"""Configuration shim re-exporting from app.core.config."""

from app.core.config import DEFAULT_NODE_SECONDS, Settings, settings

__all__ = ["DEFAULT_NODE_SECONDS", "Settings", "settings"]
