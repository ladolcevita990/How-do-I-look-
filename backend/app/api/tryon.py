import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_session_id
from app.models.database import Garment, Photo, TryOnJob, get_db
from app.models.schemas import TryOnRequest, TryOnResponse, TryOnStatus
from app.services.storage import download_file, upload_file
from app.services.tryon_engine import run_tryon

router = APIRouter()


async def process_tryon_job(job_id: str, photo_path: str, garment_path: str, category: str):
    """Background task to run try-on inference."""
    from app.models.database import SessionLocal

    db = SessionLocal()
    try:
        job = db.query(TryOnJob).filter(TryOnJob.id == job_id).first()
        if not job:
            return

        job.status = "processing"
        db.commit()

        # Download images from S3
        human_image = download_file(photo_path)
        garment_image = download_file(garment_path)

        # Run inference
        result_bytes = await run_tryon(human_image, garment_image, category)

        # Upload result
        result_key = f"results/{job_id}/result.jpg"
        upload_file(result_key, result_bytes, "image/jpeg")

        job.status = "complete"
        job.result_path = result_key
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        job = db.query(TryOnJob).filter(TryOnJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/tryon", response_model=TryOnResponse)
async def create_tryon(
    req: TryOnRequest,
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

    garment = (
        db.query(Garment)
        .filter(Garment.id == req.garment_id, Garment.session_id == session_id)
        .first()
    )
    if not garment:
        raise HTTPException(404, "Garment not found")

    job_id = str(uuid.uuid4())
    job = TryOnJob(
        id=job_id,
        photo_id=req.photo_id,
        garment_id=req.garment_id,
        status="queued",
    )
    db.add(job)
    db.commit()

    background_tasks.add_task(
        process_tryon_job,
        job_id=job_id,
        photo_path=photo.resized_path,
        garment_path=garment.processed_path,
        category=garment.category,
    )

    return TryOnResponse(job_id=job_id, status="queued")


@router.get("/tryon/{job_id}", response_model=TryOnStatus)
async def get_tryon_status(
    job_id: str,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    job = (
        db.query(TryOnJob)
        .join(Photo, Photo.id == TryOnJob.photo_id)
        .filter(TryOnJob.id == job_id, Photo.session_id == session_id)
        .first()
    )
    if not job:
        raise HTTPException(404, "Try-on job not found")

    result_url = f"/api/files/{job.result_path}" if job.result_path else None

    return TryOnStatus(
        job_id=job.id,
        status=job.status,
        result_url=result_url,
        error=job.error or None,
    )
