"""Authentication shim re-exporting from app.core.security."""

from app.core.security import User, current_user

__all__ = ["User", "current_user"]
