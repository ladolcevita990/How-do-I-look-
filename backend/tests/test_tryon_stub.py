"""Smoke tests for the local stub try-on backend and the compositing pipeline.

These run without any network or API keys so CI stays free.
"""

import io

import pytest
from PIL import Image

from app.config import settings
from app.models.schemas import OutfitItem
from app.services.compositing import compose_outfit
from app.services.tryon_engine import run_tryon


def _png_bytes(color: tuple[int, int, int, int], size=(200, 400)) -> bytes:
    img = Image.new("RGBA", size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _body_jpeg() -> bytes:
    img = Image.new("RGB", (768, 1024), (220, 210, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _force_stub(monkeypatch):
    monkeypatch.setattr(settings, "tryon_backend", "stub")


@pytest.mark.parametrize("category", ["upper_body", "lower_body", "dresses"])
async def test_run_tryon_stub_returns_valid_jpeg(category):
    body = _body_jpeg()
    garment = _png_bytes((180, 60, 60, 255))

    result = await run_tryon(body, garment, category)

    assert isinstance(result, bytes) and len(result) > 0
    img = Image.open(io.BytesIO(result))
    assert img.format == "JPEG"
    assert img.size == (768, 1024)


async def test_run_tryon_rejects_non_clothing():
    with pytest.raises(ValueError):
        await run_tryon(_body_jpeg(), _png_bytes((0, 0, 0, 255)), "shoes")


async def test_compose_outfit_full_look():
    body = _body_jpeg()
    garments = {
        "g1": _png_bytes((50, 80, 200, 255)),    # sweater
        "g2": _png_bytes((40, 40, 60, 255)),     # trousers
        "g3": _png_bytes((20, 20, 20, 255)),     # loafers
        "g4": _png_bytes((10, 10, 10, 255)),     # sunglasses
    }
    items = [
        OutfitItem(garment_id="g1", category="upper_body"),
        OutfitItem(garment_id="g2", category="lower_body"),
        OutfitItem(garment_id="g3", category="shoes"),
        OutfitItem(garment_id="g4", category="accessories", accessory_type="sunglasses"),
    ]

    final, intermediates = await compose_outfit(body, garments, items)

    assert isinstance(final, bytes) and len(final) > 0
    assert len(intermediates) == 4
    img = Image.open(io.BytesIO(final))
    assert img.format == "JPEG"


async def test_dress_replaces_upper_and_lower():
    body = _body_jpeg()
    garments = {
        "top": _png_bytes((10, 10, 10, 255)),
        "bottom": _png_bytes((10, 10, 10, 255)),
        "dress": _png_bytes((200, 30, 120, 255)),
    }
    items = [
        OutfitItem(garment_id="top", category="upper_body"),
        OutfitItem(garment_id="bottom", category="lower_body"),
        OutfitItem(garment_id="dress", category="dresses"),
    ]

    _, intermediates = await compose_outfit(body, garments, items)

    # upper_body and lower_body are dropped when a dress is present
    assert len(intermediates) == 1
