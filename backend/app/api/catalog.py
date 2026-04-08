import base64
import json
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_session_id
from app.models.database import Garment, get_db
from app.models.schemas import (
    GarmentFetchRequest,
    GarmentPreview,
    GarmentPreviewRequest,
    GarmentResponse,
    GarmentSearchResult,
)
from app.services.garment_scraper import (
    classify_category,
    download_image,
    fetch_product_image,
    search_garments,
)
from app.services.preprocessing import image_to_bytes, validate_image
from app.services.storage import upload_file

router = APIRouter()


def garment_to_response(g: Garment) -> GarmentResponse:
    processed_url = f"/api/files/{g.processed_path}" if g.processed_path else None
    metadata = json.loads(g.metadata_json) if g.metadata_json else {}
    return GarmentResponse(
        id=g.id,
        name=g.name,
        brand=g.brand,
        category=g.category,
        accessory_type=g.accessory_type or None,
        source=g.source,
        original_url=g.original_url,
        processed_url=processed_url,
        metadata=metadata,
        created_at=g.created_at,
    )


def _process_garment_bytes(data: bytes, garment_id: str) -> str:
    """Remove background if rembg is available, upload to S3, return the key."""
    try:
        from rembg import remove

        processed = remove(data)
        key = f"garments/{garment_id}/processed.png"
        upload_file(key, processed, "image/png")
        return key
    except ImportError:
        img = validate_image(data)
        key = f"garments/{garment_id}/original.jpg"
        upload_file(key, image_to_bytes(img.convert("RGB")), "image/jpeg")
        return key


# ---------------------------------------------------------------------------
# URL-first flow: preview (no DB) → user confirms → commit
# ---------------------------------------------------------------------------


@router.post("/garments/preview", response_model=GarmentPreview)
async def preview_garment_from_url(req: GarmentPreviewRequest):
    """Scrape a product URL and return an in-memory preview.

    No database write; the frontend shows this in a modal so the user can
    edit the auto-detected category before calling ``/garments/confirm``.
    """
    try:
        info = await fetch_product_image(req.url)
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch product page: {e}")

    if not info.get("image_url"):
        raise HTTPException(400, "Could not find a product image on the page")

    try:
        image_bytes = await download_image(info["image_url"])
        validate_image(image_bytes)
    except Exception as e:
        raise HTTPException(400, f"Failed to download product image: {e}")

    # Background-remove now so the preview modal shows the final look.
    try:
        from rembg import remove

        processed = remove(image_bytes)
        mime = "image/png"
    except ImportError:
        processed = image_bytes
        mime = "image/jpeg"

    data_url = f"data:{mime};base64,{base64.b64encode(processed).decode('ascii')}"
    category, accessory_type = classify_category(info.get("title", ""), req.url)

    return GarmentPreview(
        image_data_url=data_url,
        title=info.get("title", ""),
        brand=info.get("brand", ""),
        price=info.get("price", ""),
        category=category,
        accessory_type=accessory_type,
        source_url=req.url,
    )


@router.post("/garments/confirm", response_model=GarmentResponse)
async def confirm_garment_from_url(
    req: GarmentFetchRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Commit a previewed product to the session's closet.

    Re-fetches the image (the preview data URL is not sent back) and persists
    the garment under the current session.
    """
    try:
        info = await fetch_product_image(req.url)
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch product page: {e}")

    if not info.get("image_url"):
        raise HTTPException(400, "Could not find a product image on the page")

    try:
        image_bytes = await download_image(info["image_url"])
        validate_image(image_bytes)
    except Exception as e:
        raise HTTPException(400, f"Failed to download product image: {e}")

    garment_id = str(uuid.uuid4())
    processed_key = _process_garment_bytes(image_bytes, garment_id)

    garment = Garment(
        id=garment_id,
        session_id=session_id,
        name=req.name or info.get("title", "Unknown Garment"),
        brand=req.brand or info.get("brand", ""),
        category=req.category,
        accessory_type=req.accessory_type or "",
        source="scraper",
        original_url=req.url,
        processed_path=processed_key,
        metadata_json=json.dumps(
            {"price": info.get("price", ""), "image_url": info["image_url"]}
        ),
    )
    db.add(garment)
    db.commit()

    return garment_to_response(garment)


# Backwards-compatible alias: /garments/fetch = preview + confirm in one call,
# for any old clients that may still be pointed at it.
@router.post("/garments/fetch", response_model=GarmentResponse)
async def fetch_garment_from_url(
    req: GarmentFetchRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    return await confirm_garment_from_url(req, session_id=session_id, db=db)


# ---------------------------------------------------------------------------
# Search + manual upload + listing
# ---------------------------------------------------------------------------


@router.get("/garments/search", response_model=list[GarmentSearchResult])
async def search_garments_endpoint(q: str, category: str = ""):
    """Search for garments via Google Shopping."""
    return await search_garments(q, category)


@router.post("/garments/upload", response_model=GarmentResponse)
async def upload_garment(
    file: UploadFile,
    name: str = Form("Uploaded Garment"),
    brand: str = Form(""),
    category: str = Form("upper_body"),
    accessory_type: str = Form(""),
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    """Manually upload a garment image."""
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large, maximum 10MB")

    try:
        validate_image(data)
    except ValueError as e:
        raise HTTPException(400, str(e))

    garment_id = str(uuid.uuid4())
    processed_key = _process_garment_bytes(data, garment_id)

    garment = Garment(
        id=garment_id,
        session_id=session_id,
        name=name,
        brand=brand,
        category=category,
        accessory_type=accessory_type,
        source="manual",
        processed_path=processed_key,
    )
    db.add(garment)
    db.commit()

    return garment_to_response(garment)


@router.get("/garments", response_model=list[GarmentResponse])
async def list_garments(
    category: str = "",
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    query = db.query(Garment).filter(Garment.session_id == session_id)
    if category:
        query = query.filter(Garment.category == category)
    garments = query.order_by(Garment.created_at.desc()).limit(200).all()
    return [garment_to_response(g) for g in garments]


@router.get("/garments/{garment_id}", response_model=GarmentResponse)
async def get_garment(
    garment_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    garment = (
        db.query(Garment)
        .filter(Garment.id == garment_id, Garment.session_id == session_id)
        .first()
    )
    if not garment:
        raise HTTPException(404, "Garment not found")
    return garment_to_response(garment)
