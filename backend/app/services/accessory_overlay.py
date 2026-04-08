"""Accessory + shoe overlays anchored on MediaPipe landmarks.

The try-on engine (IDM-VTON or stub) only handles clothing. Shoes and every
accessory sub-type (sunglasses, hats, watches, belts, ties, scarves) are
composited locally using ``PoseAnchors`` from ``pose_anchors.py``. Each
handler takes the current composite + the accessory product image and returns
a new JPEG bytes result.

The compositing layer (``compositing.py``) calls ``apply_accessory`` with a
sub-type string; this module dispatches to the right handler.
"""

from __future__ import annotations

import io
import logging
import math

from PIL import Image

from app.services.pose_anchors import PoseAnchors, detect_pose

logger = logging.getLogger(__name__)

Point = tuple[int, int]


def apply_accessory(
    base_image: bytes,
    overlay_image: bytes,
    accessory_type: str,
) -> bytes:
    """Dispatch to the right overlay handler by sub-type."""
    handler = _HANDLERS.get(accessory_type, _apply_generic)
    return handler(base_image, overlay_image)


def apply_shoes(base_image: bytes, overlay_image: bytes) -> bytes:
    """Place a shoe product image at both feet, scaled and rotated per-foot."""
    base = Image.open(io.BytesIO(base_image)).convert("RGBA")
    shoe = Image.open(io.BytesIO(overlay_image)).convert("RGBA")
    anchors = detect_pose(base)

    def place_shoe(img: Image.Image, ankle: Point, foot: Point, flip: bool) -> None:
        dx = foot[0] - ankle[0]
        dy = foot[1] - ankle[1]
        # A typical shoe is ~0.75x the hip width wide; scale by hip width.
        target_w = int(max(60, anchors.hip_width * 0.75))
        aspect = img.height / max(1, img.width)
        target_h = int(target_w * aspect)
        scaled = img.resize((target_w, target_h), Image.LANCZOS)
        if flip:
            scaled = scaled.transpose(Image.FLIP_LEFT_RIGHT)
        # Rotate to match ankle→foot direction (0 = pointing down).
        angle = math.degrees(math.atan2(dx, dy))
        rotated = scaled.rotate(angle, expand=True, resample=Image.BICUBIC)
        # Anchor the top-center of the shoe at the ankle.
        paste_x = ankle[0] - rotated.width // 2
        paste_y = ankle[1] - int(rotated.height * 0.15)
        base.paste(rotated, (paste_x, paste_y), rotated)

    if anchors.left_ankle and anchors.left_foot:
        place_shoe(shoe, anchors.left_ankle, anchors.left_foot, flip=False)
    if anchors.right_ankle and anchors.right_foot:
        place_shoe(shoe, anchors.right_ankle, anchors.right_foot, flip=True)

    return _save_jpeg(base)


# ---------------------------------------------------------------------------
# Accessory handlers
# ---------------------------------------------------------------------------


def _apply_sunglasses(base_image: bytes, overlay_image: bytes) -> bytes:
    base = Image.open(io.BytesIO(base_image)).convert("RGBA")
    overlay = Image.open(io.BytesIO(overlay_image)).convert("RGBA")
    a = detect_pose(base)

    lx, ly = a.left_eye_outer
    rx, ry = a.right_eye_outer
    eye_dist = math.hypot(rx - lx, ry - ly)
    width = int(eye_dist * 1.7)
    scaled = _scale_to_width(overlay, width)
    angle = -math.degrees(math.atan2(ry - ly, rx - lx))
    rotated = scaled.rotate(angle, expand=True, resample=Image.BICUBIC)

    nx, ny = a.nose_bridge
    paste_x = nx - rotated.width // 2
    paste_y = ny - rotated.height // 2
    base.paste(rotated, (paste_x, paste_y), rotated)
    return _save_jpeg(base)


def _apply_hat(base_image: bytes, overlay_image: bytes) -> bytes:
    base = Image.open(io.BytesIO(base_image)).convert("RGBA")
    overlay = Image.open(io.BytesIO(overlay_image)).convert("RGBA")
    a = detect_pose(base)

    lex, ley = a.left_ear
    rex, rey = a.right_ear
    ear_dist = math.hypot(rex - lex, rey - ley)
    width = int(ear_dist * 1.6)
    scaled = _scale_to_width(overlay, width)
    angle = -math.degrees(math.atan2(rey - ley, rex - lex))
    rotated = scaled.rotate(angle, expand=True, resample=Image.BICUBIC)

    hx, hy = a.head_top
    # Anchor the bottom-center of the hat near the head top.
    paste_x = hx - rotated.width // 2
    paste_y = hy - int(rotated.height * 0.75)
    base.paste(rotated, (paste_x, paste_y), rotated)
    return _save_jpeg(base)


def _apply_watch(base_image: bytes, overlay_image: bytes) -> bytes:
    base = Image.open(io.BytesIO(base_image)).convert("RGBA")
    overlay = Image.open(io.BytesIO(overlay_image)).convert("RGBA")
    a = detect_pose(base)

    # Prefer the left wrist (conventional). Fall back to right.
    wrist = a.left_wrist or a.right_wrist
    elbow = a.left_elbow or a.right_elbow
    if not wrist:
        return _save_jpeg(base)
    width = max(40, int(a.shoulder_width * 0.22))
    scaled = _scale_to_width(overlay, width)
    if elbow:
        dx = wrist[0] - elbow[0]
        dy = wrist[1] - elbow[1]
        angle = -math.degrees(math.atan2(dx, dy))
        scaled = scaled.rotate(angle, expand=True, resample=Image.BICUBIC)
    paste_x = wrist[0] - scaled.width // 2
    paste_y = wrist[1] - scaled.height // 2
    base.paste(scaled, (paste_x, paste_y), scaled)
    return _save_jpeg(base)


def _apply_belt(base_image: bytes, overlay_image: bytes) -> bytes:
    base = Image.open(io.BytesIO(base_image)).convert("RGBA")
    overlay = Image.open(io.BytesIO(overlay_image)).convert("RGBA")
    a = detect_pose(base)

    width = int(a.hip_width * 1.1)
    scaled = _scale_to_width(overlay, width)
    hx, hy = a.hips_center
    # Sit just above the hip line.
    paste_x = hx - scaled.width // 2
    paste_y = hy - int(scaled.height * 0.8)
    base.paste(scaled, (paste_x, paste_y), scaled)
    return _save_jpeg(base)


def _apply_tie_or_scarf(base_image: bytes, overlay_image: bytes) -> bytes:
    base = Image.open(io.BytesIO(base_image)).convert("RGBA")
    overlay = Image.open(io.BytesIO(overlay_image)).convert("RGBA")
    a = detect_pose(base)

    width = int(a.shoulder_width * 0.55)
    scaled = _scale_to_width(overlay, width)
    cx, cy = a.shoulders_center
    chin = a.chin or (cx, cy - 20)
    paste_x = cx - scaled.width // 2
    paste_y = chin[1]
    base.paste(scaled, (paste_x, paste_y), scaled)
    return _save_jpeg(base)


def _apply_generic(base_image: bytes, overlay_image: bytes) -> bytes:
    """Fallback — place at torso center scaled to 40% of shoulder width."""
    base = Image.open(io.BytesIO(base_image)).convert("RGBA")
    overlay = Image.open(io.BytesIO(overlay_image)).convert("RGBA")
    a = detect_pose(base)
    width = int(a.shoulder_width * 0.4)
    scaled = _scale_to_width(overlay, width)
    cx, cy = a.shoulders_center
    paste_x = cx - scaled.width // 2
    paste_y = cy
    base.paste(scaled, (paste_x, paste_y), scaled)
    return _save_jpeg(base)


_HANDLERS = {
    "sunglasses": _apply_sunglasses,
    "hat": _apply_hat,
    "watch": _apply_watch,
    "belt": _apply_belt,
    "tie": _apply_tie_or_scarf,
    "scarf": _apply_tie_or_scarf,
}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _scale_to_width(img: Image.Image, target_w: int) -> Image.Image:
    target_w = max(1, target_w)
    aspect = img.height / max(1, img.width)
    target_h = max(1, int(target_w * aspect))
    return img.resize((target_w, target_h), Image.LANCZOS)


def _save_jpeg(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue()
