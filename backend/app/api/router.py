from fastapi import APIRouter

from app.api.catalog import router as catalog_router
from app.api.outfit import router as outfit_router
from app.api.session import router as session_router
from app.api.tryon import router as tryon_router
from app.api.upload import router as upload_router

api_router = APIRouter(prefix="/api")
api_router.include_router(session_router, tags=["session"])
api_router.include_router(upload_router, tags=["upload"])
api_router.include_router(catalog_router, tags=["catalog"])
api_router.include_router(tryon_router, tags=["tryon"])
api_router.include_router(outfit_router, tags=["outfit"])
