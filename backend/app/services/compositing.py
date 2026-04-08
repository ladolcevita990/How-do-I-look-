"""Outfit compositing pipeline.

Takes a body photo plus a set of garments and runs them through the correct
layers in a deterministic z-order so every accessory ends up on top of the
right clothing. Clothing (upper_body, lower_body, dresses) goes through the
try-on engine; shoes and accessories go through ``accessory_overlay``.

Layer order (bottom → top):
    1. lower_body          (trousers, skirt)
    2. upper_body          (shirt, sweater, jacket)
    3. dresses             (replaces lower+upper when present)
    4. belt
    5. shoes
    6. tie / scarf
    7. watch
    8. hat
    9. sunglasses
"""

from __future__ import annotations

import logging

from app.models.schemas import OutfitItem
from app.services.accessory_overlay import apply_accessory, apply_shoes
from app.services.tryon_engine import run_tryon

logger = logging.getLogger(__name__)


def _layer_key(item: OutfitItem) -> int:
    if item.category == "lower_body":
        return 1
    if item.category == "upper_body":
        return 2
    if item.category == "dresses":
        return 3
    if item.category == "shoes":
        return 5
    if item.category == "accessories":
        sub = item.accessory_type or ""
        return {
            "belt": 4,
            "tie": 6,
            "scarf": 6,
            "watch": 7,
            "hat": 8,
            "sunglasses": 9,
        }.get(sub, 10)
    return 99


def _sort_items(items: list[OutfitItem]) -> list[OutfitItem]:
    # If a dress is present, drop any upper_body / lower_body items — the
    # dress replaces both.
    has_dress = any(i.category == "dresses" for i in items)
    filtered = [
        i for i in items
        if not (has_dress and i.category in ("upper_body", "lower_body"))
    ]
    return sorted(filtered, key=_layer_key)


async def compose_outfit(
    photo_image: bytes,
    garment_images: dict[str, bytes],
    garment_items: list[OutfitItem],
) -> tuple[bytes, list[bytes]]:
    """Compose a full outfit by piping each layer's output into the next.

    Returns ``(final_image, intermediate_snapshots)``.
    """
    ordered = _sort_items(garment_items)
    current = photo_image
    intermediates: list[bytes] = []

    for item in ordered:
        garment_bytes = garment_images[item.garment_id]
        try:
            if item.category in ("upper_body", "lower_body", "dresses"):
                current = await run_tryon(current, garment_bytes, item.category)
            elif item.category == "shoes":
                current = apply_shoes(current, garment_bytes)
            elif item.category == "accessories":
                current = apply_accessory(
                    current, garment_bytes, item.accessory_type or "other"
                )
            else:
                logger.warning("Unknown category: %s, skipping", item.category)
                continue
        except Exception as e:  # pragma: no cover - log and keep going
            logger.exception("Layer %s failed: %s", item.category, e)
            continue

        intermediates.append(current)

    return current, intermediates
