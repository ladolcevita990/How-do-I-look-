"""Virtual try-on engine.

Two backends are supported, selected via ``settings.tryon_backend``:

* ``stub`` — local PIL compositor. Uses pose landmarks to crop the garment
  image onto the torso or legs region of the body photo. Free, fast, no keys.
  Good enough for development and for clicking through the full UX.
* ``replicate`` — real IDM-VTON inference via the Replicate API. Photoreal
  results for clothing (upper_body, lower_body, dresses). Costs ~$0.03/run.
"""

import io
import logging

import httpx
from PIL import Image

from app.config import settings
from app.services.pose_anchors import detect_pose

logger = logging.getLogger(__name__)

SUPPORTED_CATEGORIES = ("upper_body", "lower_body", "dresses")


async def run_tryon(
    human_image: bytes,
    garment_image: bytes,
    category: str,
) -> bytes:
    """Run a virtual try-on for a single clothing garment.

    The body image must be a JPEG/PNG of a full-body photo. The garment image
    should be a product photo, ideally with its background removed. Returns
    the composited result as JPEG bytes.
    """
    if category not in SUPPORTED_CATEGORIES:
        raise ValueError(
            f"run_tryon only handles clothing ({SUPPORTED_CATEGORIES}); "
            f"got {category!r}. Accessories and shoes go through accessory_overlay."
        )

    if settings.tryon_backend == "replicate":
        return await _run_replicate(human_image, garment_image, category)
    return _run_stub(human_image, garment_image, category)


# ---------------------------------------------------------------------------
# Stub backend — local PIL compositor anchored on MediaPipe landmarks
# ---------------------------------------------------------------------------

def _run_stub(human_image: bytes, garment_image: bytes, category: str) -> bytes:
    base = Image.open(io.BytesIO(human_image)).convert("RGBA")
    garment = Image.open(io.BytesIO(garment_image)).convert("RGBA")

    anchors = detect_pose(base)

    if category == "upper_body":
        box = anchors.torso_box()
    elif category == "lower_body":
        box = anchors.legs_box()
    else:  # dresses — torso + legs combined
        tl, tt, tr, tb = anchors.torso_box()
        ll, lt, lr, lb = anchors.legs_box()
        box = (min(tl, ll), tt, max(tr, lr), lb)

    left, top, right, bottom = box
    target_w = max(1, right - left)
    target_h = max(1, bottom - top)

    # Fit the garment into the target box while keeping aspect ratio.
    garment = _fit_into(garment, target_w, target_h)

    # Center within the box
    gw, gh = garment.size
    paste_x = left + (target_w - gw) // 2
    paste_y = top + (target_h - gh) // 2

    # Soft alpha blend so the stub result looks like a composite, not a sticker.
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.paste(garment, (paste_x, paste_y), garment)
    blended = Image.alpha_composite(base, layer)

    buf = io.BytesIO()
    blended.convert("RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _fit_into(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = img.size
    if w == 0 or h == 0:
        return img
    scale = min(max_w / w, max_h / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return img.resize((new_w, new_h), Image.LANCZOS)


# ---------------------------------------------------------------------------
# Replicate backend — IDM-VTON
# ---------------------------------------------------------------------------

_IDM_VTON_VERSION = (
    "cuuupid/idm-vton:c871bb9b046c1584f06571c8a90edcf348a68e82569e8fc9658db24a65a8f4c0"
)


async def _run_replicate(human_image: bytes, garment_image: bytes, category: str) -> bytes:
    import replicate  # imported lazily so the stub path has no hard dep

    if not settings.replicate_api_token:
        raise RuntimeError(
            "TRYON_BACKEND=replicate but REPLICATE_API_TOKEN is not set. "
            "Either set the token or switch to TRYON_BACKEND=stub."
        )

    client = replicate.Client(api_token=settings.replicate_api_token)
    logger.info("Starting IDM-VTON inference for category: %s", category)

    output = client.run(
        _IDM_VTON_VERSION,
        input={
            "human_img": io.BytesIO(human_image),
            "garm_img": io.BytesIO(garment_image),
            "category": category,
            "seed": 42,
            "steps": 30,
        },
    )

    result_url = str(output)
    logger.info("IDM-VTON complete; downloading %s", result_url)
    async with httpx.AsyncClient(timeout=60) as http:
        response = await http.get(result_url)
        response.raise_for_status()
        return response.content
