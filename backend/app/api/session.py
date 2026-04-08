"""Session endpoint.

Issues and verifies a long-lived signed ``hdil_session`` HttpOnly cookie that
scopes every photo, garment and outfit to a returning browser. Closing the
tab and coming back a month later in the same browser still finds your stuff.

No email, no password, no account. The only way to "log out" is to click
``Clear session`` on ``/lookbook`` (which calls ``DELETE /api/session``).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_session_id, sign_session_id, unsign_session_id
from app.config import settings
from app.models.database import Garment, Outfit, Photo, get_db

router = APIRouter()


def _set_cookie(response: Response, signed_value: str) -> None:
    # Cross-origin deploys (e.g. Vercel frontend + Render backend) require
    # SameSite=None, and browsers reject SameSite=None without Secure. The
    # settings default to ``lax`` + ``secure=False`` for same-origin local dev.
    response.set_cookie(
        settings.session_cookie_name,
        value=signed_value,
        max_age=settings.session_cookie_max_age,
        httponly=True,
        samesite=settings.session_cookie_samesite,
        secure=settings.session_cookie_secure,
        path="/",
    )


@router.get("/session")
async def get_or_create_session(
    response: Response,
    hdil_session: str | None = Cookie(default=None),
):
    """Return the current ``session_id``, creating and setting a cookie if needed."""
    if hdil_session:
        existing = unsign_session_id(hdil_session)
        if existing:
            return {"session_id": existing, "returning": True}

    new_id = str(uuid.uuid4())
    _set_cookie(response, sign_session_id(new_id))
    return {"session_id": new_id, "returning": False}


@router.get("/session/state")
async def get_session_state(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Return everything the frontend needs to rehydrate on boot.

    Includes the most recent photo for this session, every garment in the
    session's closet, and every saved outfit with its result URL.
    """
    photo = (
        db.query(Photo)
        .filter(Photo.session_id == session_id, Photo.status == "ready")
        .order_by(Photo.created_at.desc())
        .first()
    )
    photo_payload = None
    if photo:
        photo_payload = {
            "photo_id": photo.id,
            "resized_url": f"/api/files/{photo.resized_path}",
            "created_at": photo.created_at.isoformat(),
        }

    garments = (
        db.query(Garment)
        .filter(Garment.session_id == session_id)
        .order_by(Garment.created_at.desc())
        .all()
    )
    garment_payload = [
        {
            "id": g.id,
            "name": g.name,
            "brand": g.brand,
            "category": g.category,
            "accessory_type": g.accessory_type or None,
            "processed_url": f"/api/files/{g.processed_path}" if g.processed_path else None,
        }
        for g in garments
    ]

    outfits = (
        db.query(Outfit)
        .filter(Outfit.session_id == session_id, Outfit.is_saved == 1)
        .order_by(Outfit.created_at.desc())
        .all()
    )
    outfit_payload = [
        {
            "id": o.id,
            "share_id": o.share_id,
            "name": o.name or "Untitled look",
            "result_url": f"/api/files/{o.result_path}" if o.result_path else None,
            "created_at": o.created_at.isoformat(),
            "items": [
                {
                    "garment_id": i.garment_id,
                    "category": i.garment.category if i.garment else "",
                    "accessory_type": (i.accessory_type or (i.garment.accessory_type if i.garment else "")) or None,
                }
                for i in o.items
            ],
        }
        for o in outfits
    ]

    return {
        "session_id": session_id,
        "photo": photo_payload,
        "garments": garment_payload,
        "outfits": outfit_payload,
    }


@router.delete("/session")
async def clear_session(
    response: Response,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Delete everything owned by this session and clear the cookie."""
    db.query(Outfit).filter(Outfit.session_id == session_id).delete()
    db.query(Garment).filter(Garment.session_id == session_id).delete()
    db.query(Photo).filter(Photo.session_id == session_id).delete()
    db.commit()

    # Issue a brand-new anonymous session so the app keeps working.
    new_id = str(uuid.uuid4())
    _set_cookie(response, sign_session_id(new_id))
    return {"session_id": new_id, "cleared": True}
