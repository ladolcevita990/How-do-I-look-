from datetime import datetime
from typing import Literal

from pydantic import BaseModel

GarmentCategory = Literal["upper_body", "lower_body", "dresses", "shoes", "accessories"]
AccessoryType = Literal["sunglasses", "hat", "watch", "belt", "tie", "scarf", "other"]


class PhotoUploadResponse(BaseModel):
    photo_id: str
    status: str


class PhotoStatus(BaseModel):
    photo_id: str
    status: str
    resized_url: str | None = None


class GarmentBase(BaseModel):
    name: str
    brand: str = ""
    category: GarmentCategory
    # Only set when category == "accessories" (sunglasses, hat, watch, belt, tie, scarf).
    accessory_type: AccessoryType | None = None


class GarmentCreate(GarmentBase):
    pass


class GarmentResponse(GarmentBase):
    id: str
    source: str
    original_url: str
    processed_url: str | None = None
    metadata: dict = {}
    created_at: datetime


class GarmentFetchRequest(BaseModel):
    url: str
    category: GarmentCategory
    accessory_type: AccessoryType | None = None
    name: str = ""
    brand: str = ""


class GarmentPreviewRequest(BaseModel):
    url: str


class GarmentPreview(BaseModel):
    """Result of scraping a product URL without committing to DB yet."""
    image_data_url: str  # base64 data URL so the frontend can show it in a modal
    title: str
    brand: str
    price: str
    category: GarmentCategory
    accessory_type: AccessoryType | None = None
    source_url: str


class GarmentSearchRequest(BaseModel):
    query: str
    category: str = ""


class GarmentSearchResult(BaseModel):
    title: str
    brand: str
    image_url: str
    product_url: str
    price: str = ""


class TryOnRequest(BaseModel):
    photo_id: str
    garment_id: str


class TryOnResponse(BaseModel):
    job_id: str
    status: str


class TryOnStatus(BaseModel):
    job_id: str
    status: str
    result_url: str | None = None
    error: str | None = None


class OutfitItem(BaseModel):
    garment_id: str
    category: GarmentCategory
    accessory_type: AccessoryType | None = None


class OutfitRequest(BaseModel):
    photo_id: str
    garments: list[OutfitItem]


class SavedOutfitItem(BaseModel):
    garment_id: str
    category: GarmentCategory
    accessory_type: AccessoryType | None = None


class SavedOutfit(BaseModel):
    id: str
    share_id: str
    result_url: str | None = None
    items: list[SavedOutfitItem]
    created_at: datetime


class OutfitResponse(BaseModel):
    job_id: str
    status: str


class OutfitStatus(BaseModel):
    job_id: str
    status: str
    result_url: str | None = None
    intermediate_urls: list[str] = []
    error: str | None = None
