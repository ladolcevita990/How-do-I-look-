import io

from PIL import Image


def validate_image(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    if img.format not in ("JPEG", "PNG", "WEBP"):
        raise ValueError(f"Unsupported image format: {img.format}. Use JPEG, PNG, or WEBP.")
    if img.size[0] < 100 or img.size[1] < 100:
        raise ValueError("Image is too small. Minimum 100x100 pixels.")
    return img


def resize_for_tryon(img: Image.Image, target_w: int = 768, target_h: int = 1024) -> Image.Image:
    """Resize image to target dimensions, maintaining aspect ratio with padding."""
    img = img.convert("RGB")
    orig_w, orig_h = img.size

    scale = min(target_w / orig_w, target_h / orig_h)
    new_w = int(orig_w * scale)
    new_h = int(orig_h * scale)

    img = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (target_w, target_h), (255, 255, 255))
    paste_x = (target_w - new_w) // 2
    paste_y = (target_h - new_h) // 2
    canvas.paste(img, (paste_x, paste_y))

    return canvas


def image_to_bytes(img: Image.Image, format: str = "JPEG", quality: int = 95) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=format, quality=quality)
    buf.seek(0)
    return buf.read()
