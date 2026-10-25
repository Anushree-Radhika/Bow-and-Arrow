"""Supabase auth: the browser sends its Supabase access token; we ask Supabase who it belongs to.

Asking Supabase (instead of verifying the JWT locally) works for both legacy HS256 secrets and the
newer asymmetric signing keys, and a revoked session stops working immediately. Results are cached
for a minute so a burst of requests costs one round trip.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import httpx
from fastapi import Header, HTTPException

from config import settings


@dataclass(frozen=True)
class User:
    id: str
    token: str  # forwarded to PostgREST so Row-Level Security sees auth.uid()


_cache: dict[str, tuple[float, str]] = {}
_TTL = 60.0


def current_user(authorization: str | None = Header(default=None)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in to use Organizer.")
    token = authorization.split(" ", 1)[1].strip()

    hit = _cache.get(token)
    if hit and hit[0] > time.monotonic():
        return User(hit[1], token)

    try:
        r = httpx.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.HTTPError:
        raise HTTPException(503, "Couldn't reach Supabase to check your session. Try again.")
    if r.status_code != 200:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    uid = r.json().get("id")
    if not uid:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    if len(_cache) > 1000:
        _cache.clear()
    _cache[token] = (time.monotonic() + _TTL, uid)
    return User(uid, token)
