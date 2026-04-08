import json
import logging
import re

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.models.schemas import GarmentSearchResult

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}


async def fetch_product_image(url: str) -> dict:
    """Fetch product image and metadata from a product page URL.

    Tries multiple extraction strategies:
    1. Open Graph meta tags (og:image)
    2. Schema.org Product structured data
    3. Largest image heuristic
    """
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        response = await client.get(url, headers=HEADERS)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    result = {"image_url": "", "title": "", "brand": "", "price": ""}

    # Try og:image
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        result["image_url"] = og_image["content"]

    # Try og:title
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        result["title"] = og_title["content"]

    # Try schema.org Product JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            products = []
            if isinstance(data, list):
                products = [d for d in data if d.get("@type") == "Product"]
            elif isinstance(data, dict):
                if data.get("@type") == "Product":
                    products = [data]
                elif "@graph" in data:
                    products = [d for d in data["@graph"] if d.get("@type") == "Product"]

            for product in products:
                if not result["image_url"] and product.get("image"):
                    img = product["image"]
                    result["image_url"] = img[0] if isinstance(img, list) else img
                if not result["title"] and product.get("name"):
                    result["title"] = product["name"]
                if product.get("brand"):
                    brand = product["brand"]
                    result["brand"] = brand.get("name", brand) if isinstance(brand, dict) else str(brand)
                if product.get("offers"):
                    offers = product["offers"]
                    if isinstance(offers, list):
                        offers = offers[0]
                    if isinstance(offers, dict) and offers.get("price"):
                        currency = offers.get("priceCurrency", "")
                        result["price"] = f"{currency} {offers['price']}".strip()
        except (json.JSONDecodeError, TypeError, KeyError):
            continue

    # Fallback: find largest product image
    if not result["image_url"]:
        images = soup.find_all("img", src=re.compile(r"https?://"))
        best_img = ""
        best_score = 0
        for img in images:
            src = img.get("src", "")
            score = 0
            # Prefer larger images
            width = img.get("width")
            height = img.get("height")
            if width and height:
                try:
                    score = int(width) * int(height)
                except ValueError:
                    pass
            # Boost images with product-related attributes
            alt = (img.get("alt") or "").lower()
            classes = " ".join(img.get("class") or []).lower()
            if any(kw in alt + classes for kw in ["product", "main", "hero", "gallery"]):
                score += 100000
            if score > best_score:
                best_score = score
                best_img = src
        result["image_url"] = best_img

    if not result["title"]:
        title_tag = soup.find("title")
        if title_tag:
            result["title"] = title_tag.get_text(strip=True)

    return result


async def search_garments(query: str, category: str = "") -> list[GarmentSearchResult]:
    """Search for garments using SerpAPI Google Shopping."""
    if not settings.serpapi_key:
        logger.warning("SERPAPI_KEY not set, returning empty results")
        return []

    search_query = query
    if category:
        search_query = f"{query} {category}"

    params = {
        "engine": "google_shopping",
        "q": search_query,
        "api_key": settings.serpapi_key,
        "num": 20,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get("https://serpapi.com/search", params=params)
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("shopping_results", []):
        results.append(
            GarmentSearchResult(
                title=item.get("title", ""),
                brand=item.get("source", ""),
                image_url=item.get("thumbnail", ""),
                product_url=item.get("link", ""),
                price=item.get("price", ""),
            )
        )

    return results


# ---- category / accessory classifier ------------------------------------

_CATEGORY_KEYWORDS = {
    "shoes": (
        "loafer", "loafers", "sneaker", "sneakers", "trainer", "trainers",
        "boot", "boots", "shoe", "shoes", "heel", "heels", "sandal", "sandals",
        "pump", "pumps", "derby", "oxford", "moccasin", "espadrille",
    ),
    "lower_body": (
        "trouser", "trousers", "pant", "pants", "chino", "chinos", "jean",
        "jeans", "short", "shorts", "skirt", "legging", "leggings", "jogger",
    ),
    "upper_body": (
        "shirt", "tee", "t-shirt", "polo", "sweater", "jumper", "hoodie",
        "jacket", "coat", "blazer", "cardigan", "sweatshirt", "pullover",
        "vest", "gilet", "overshirt", "parka",
    ),
    "dresses": ("dress", "gown", "jumpsuit", "romper"),
}

_ACCESSORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "sunglasses": ("sunglass", "sunglasses", "shades", "eyewear"),
    "hat": ("hat", "cap", "beanie", "beret", "fedora", "bucket"),
    "watch": ("watch", "timepiece", "chronograph"),
    "belt": ("belt",),
    "tie": ("tie", "necktie", "bow tie"),
    "scarf": ("scarf", "shawl"),
}


def classify_category(title: str, url: str = "") -> tuple[str, str | None]:
    """Best-effort category inference from a product title + URL.

    Returns ``(category, accessory_type_or_None)``. Defaults to
    ``("upper_body", None)`` when nothing matches — users can still edit the
    category in the confirm-preview modal before saving.
    """
    haystack = f"{title} {url}".lower()

    for acc_type, words in _ACCESSORY_KEYWORDS.items():
        if any(w in haystack for w in words):
            return "accessories", acc_type

    for category, words in _CATEGORY_KEYWORDS.items():
        if any(w in haystack for w in words):
            return category, None

    return "upper_body", None


async def download_image(url: str) -> bytes:
    """Download an image from a URL."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        response = await client.get(url, headers=HEADERS)
        response.raise_for_status()
        return response.content
