import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.api.router import api_router
from app.config import settings
from app.models.database import init_db
from app.services.storage import download_file, ensure_bucket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    init_db()
    try:
        ensure_bucket()
        logger.info("S3 bucket ready")
    except Exception as e:
        logger.warning(f"Could not connect to S3: {e}. Storage operations will fail until S3 is available.")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="How Do I Look? - Virtual Try-On API",
    description="Upload your photo, add clothing items, and see how they look on you.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/api/files/{path:path}")
async def serve_file(path: str):
    """Serve files from S3 storage."""
    try:
        data = download_file(path)
        content_type = "image/png" if path.endswith(".png") else "image/jpeg"
        return Response(content=data, media_type=content_type)
    except Exception:
        return Response(status_code=404, content="File not found")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
