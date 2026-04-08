import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_session_id
from app.models.database import Garment, Outfit, OutfitGarment, Photo, get_db
from app.models.schemas import OutfitRequest, OutfitResponse, OutfitStatus
from app.services.compositing import compose_outfit
from app.services.storage import download_file, upload_file

router = APIRouter()


async def process_outfit_job(job_id: str, photo_path: str, garment_data: list[dict]):
    """Background task to compose a full outfit."""
    from app.models.database import SessionLocal
    from app.models.schemas import OutfitItem

    db = SessionLocal()
    try:
        outfit = db.query(Outfit).filter(Outfit.id == job_id).first()
        if not outfit:
            return

        outfit.status = "processing"
        db.commit()

        photo_image = download_file(photo_path)

        garment_images = {}
        garment_items = []
        for gd in garment_data:
            garment_images[gd["garment_id"]] = download_file(gd["processed_path"])
            garment_items.append(
                OutfitItem(
                    garment_id=gd["garment_id"],
                    category=gd["category"],
                    accessory_type=gd.get("accessory_type") or None,
                )
            )

        final_image, intermediates = await compose_outfit(
            photo_image, garment_images, garment_items
        )

        result_key = f"outfits/{job_id}/result.jpg"
        upload_file(result_key, final_image, "image/jpeg")

        for i, img in enumerate(intermediates):
            inter_key = f"outfits/{job_id}/step_{i}.jpg"
            upload_file(inter_key, img, "image/jpeg")

        outfit.status = "complete"
        outfit.result_path = result_key
        outfit.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        outfit = db.query(Outfit).filter(Outfit.id == job_id).first()
        if outfit:
            outfit.status = "failed"
            outfit.error = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/outfit", response_model=OutfitResponse)
async def create_outfit(
    req: OutfitRequest,
    background_tasks: BackgroundTasks,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    photo = (
        db.query(Photo)
        .filter(Photo.id == req.photo_id, Photo.session_id == session_id)
        .first()
    )
    if not photo:
        raise HTTPException(404, "Photo not found")
    if photo.status != "ready":
        raise HTTPException(400, "Photo is not ready yet")

    if not req.garments:
        raise HTTPException(400, "At least one garment is required")

    garment_data = []
    for item in req.garments:
        garment = (
            db.query(Garment)
            .filter(Garment.id == item.garment_id, Garment.session_id == session_id)
            .first()
        )
        if not garment:
            raise HTTPException(404, f"Garment {item.garment_id} not found")
        garment_data.append(
            {
                "garment_id": garment.id,
                "category": item.category,
                "accessory_type": item.accessory_type or garment.accessory_type or "",
                "processed_path": garment.processed_path,
            }
        )

    outfit_id = str(uuid.uuid4())
    outfit = Outfit(
        id=outfit_id,
        session_id=session_id,
        share_id=str(uuid.uuid4()),
        photo_id=req.photo_id,
        status="queued",
        is_saved=0,
    )
    db.add(outfit)

    for i, item in enumerate(req.garments):
        og = OutfitGarment(
            outfit_id=outfit_id,
            garment_id=item.garment_id,
            order=i,
            accessory_type=item.accessory_type or "",
        )
        db.add(og)

    db.commit()

    background_tasks.add_task(
        process_outfit_job,
        job_id=outfit_id,
        photo_path=photo.resized_path,
        garment_data=garment_data,
    )

    return OutfitResponse(job_id=outfit_id, status="queued")


@router.get("/outfit/{job_id}", response_model=OutfitStatus)
async def get_outfit_status(
    job_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    outfit = (
        db.query(Outfit)
        .filter(Outfit.id == job_id, Outfit.session_id == session_id)
        .first()
    )
    if not outfit:
        raise HTTPException(404, "Outfit job not found")

    result_url = f"/api/files/{outfit.result_path}" if outfit.result_path else None

    intermediate_urls = []
    if outfit.status in ("processing", "complete"):
        for i in range(len(outfit.items)):
            inter_key = f"outfits/{job_id}/step_{i}.jpg"
            intermediate_urls.append(f"/api/files/{inter_key}")

    return OutfitStatus(
        job_id=outfit.id,
        status=outfit.status,
        result_url=result_url,
        intermediate_urls=intermediate_urls,
        error=outfit.error or None,
    )


# ---------------------------------------------------------------------------
# Save / list / share
# ---------------------------------------------------------------------------


class SaveOutfitRequest(BaseModel):
    name: str = ""


@router.post("/outfits/{job_id}/save")
async def save_outfit(
    job_id: str,
    req: SaveOutfitRequest,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    outfit = (
        db.query(Outfit)
        .filter(Outfit.id == job_id, Outfit.session_id == session_id)
        .first()
    )
    if not outfit:
        raise HTTPException(404, "Outfit not found")
    if outfit.status != "complete":
        raise HTTPException(400, "Outfit is not ready yet")

    outfit.is_saved = 1
    outfit.name = req.name or outfit.name or "Untitled look"
    db.commit()

    return {
        "id": outfit.id,
        "share_id": outfit.share_id,
        "name": outfit.name,
        "result_url": f"/api/files/{outfit.result_path}" if outfit.result_path else None,
        "created_at": outfit.created_at.isoformat(),
    }


@router.get("/outfits")
async def list_saved_outfits(
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    outfits = (
        db.query(Outfit)
        .filter(Outfit.session_id == session_id, Outfit.is_saved == 1)
        .order_by(Outfit.created_at.desc())
        .all()
    )
    return [
        {
            "id": o.id,
            "share_id": o.share_id,
            "name": o.name or "Untitled look",
            "result_url": f"/api/files/{o.result_path}" if o.result_path else None,
            "created_at": o.created_at.isoformat(),
        }
        for o in outfits
    ]


@router.get("/outfits/share/{share_id}")
async def get_shared_outfit(share_id: str, db: Session = Depends(get_db)):
    """Public read-only permalink. No session scoping."""
    outfit = db.query(Outfit).filter(Outfit.share_id == share_id).first()
    if not outfit or outfit.is_saved != 1:
        raise HTTPException(404, "Outfit not found")
    return {
        "id": outfit.id,
        "share_id": outfit.share_id,
        "name": outfit.name or "Untitled look",
        "result_url": f"/api/files/{outfit.result_path}" if outfit.result_path else None,
        "created_at": outfit.created_at.isoformat(),
        "items": [
            {
                "garment_id": i.garment_id,
                "name": i.garment.name if i.garment else "",
                "brand": i.garment.brand if i.garment else "",
                "category": i.garment.category if i.garment else "",
                "accessory_type": (i.accessory_type or (i.garment.accessory_type if i.garment else "")) or None,
                "processed_url": (
                    f"/api/files/{i.garment.processed_path}" if i.garment and i.garment.processed_path else None
                ),
            }
            for i in outfit.items
        ],
    }
