import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_session_id
from app.models.database import Photo, get_db
from app.models.schemas import PhotoStatus, PhotoUploadResponse
from app.services.preprocessing import image_to_bytes, resize_for_tryon, validate_image
from app.services.storage import upload_file

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload", response_model=PhotoUploadResponse)
async def upload_photo(
    file: UploadFile,
    session_id: str = Depends(get_session_id),
    db: Session = Depends(get_db),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Only JPEG, PNG, and WEBP images are supported")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB")

    try:
        img = validate_image(data)
    except ValueError as e:
        raise HTTPException(400, str(e))

    photo_id = str(uuid.uuid4())

    # Upload original
    original_key = f"photos/{photo_id}/original.jpg"
    upload_file(original_key, image_to_bytes(img.convert("RGB")), "image/jpeg")

    # Resize for try-on
    resized = resize_for_tryon(img)
    resized_key = f"photos/{photo_id}/resized.jpg"
    upload_file(resized_key, image_to_bytes(resized), "image/jpeg")

    # Save to database
    photo = Photo(
        id=photo_id,
        session_id=session_id,
        original_path=original_key,
        resized_path=resized_key,
        status="ready",
    )
    db.add(photo)
    db.commit()

    return PhotoUploadResponse(photo_id=photo_id, status="ready")


@router.get("/photos/{photo_id}", response_model=PhotoStatus)
async def get_photo_status(photo_id: str, db: Session = Depends(get_db)):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(404, "Photo not found")

    resized_url = f"/api/files/{photo.resized_path}" if photo.status == "ready" else None

    return PhotoStatus(
        photo_id=photo.id,
        status=photo.status,
        resized_url=resized_url,
    )
