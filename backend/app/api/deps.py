"""Shared FastAPI dependencies.

``get_session_id`` reads a signed session cookie set by ``/api/session`` and
returns the UUID string used to scope photos / garments / outfits to a
returning browser. If no cookie is present (first visit before the frontend
has called ``/api/session``) a fresh anonymous id is issued for this request
only — it will not persist, but the endpoint keeps working.
"""

from __future__ import annotations

import uuid

from fastapi import Cookie
from itsdangerous import BadSignature, URLSafeSerializer

from app.config import settings


def _serializer() -> URLSafeSerializer:
    return URLSafeSerializer(settings.session_cookie_secret, salt="hdil-session")


def sign_session_id(session_id: str) -> str:
    return _serializer().dumps(session_id)


def unsign_session_id(token: str) -> str | None:
    try:
        value = _serializer().loads(token)
    except BadSignature:
        return None
    return value if isinstance(value, str) else None


def get_session_id(hdil_session: str | None = Cookie(default=None)) -> str:
    if hdil_session:
        value = unsign_session_id(hdil_session)
        if value:
            return value
    # Transient id — the frontend should call /api/session on boot to set a
    # persistent cookie, but we don't want to crash if it hasn't yet.
    return f"anon-{uuid.uuid4()}"
