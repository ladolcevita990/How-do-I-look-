import { NextRequest } from "next/server";

import type { AccessoryType, GarmentCategory } from "@/lib/types";

export const runtime = "nodejs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

interface ScrapeResult {
  image_url: string;
  title: string;
  brand: string;
  price: string;
  category: GarmentCategory;
  accessory_type: AccessoryType | null;
  source_url: string;
}

const CATEGORY_KEYWORDS: Record<Exclude<GarmentCategory, "accessories">, string[]> = {
  shoes: [
    "loafer", "loafers", "sneaker", "sneakers", "trainer", "trainers",
    "boot", "boots", "shoe", "shoes", "heel", "heels", "sandal", "sandals",
    "pump", "pumps", "derby", "oxford", "moccasin", "espadrille",
  ],
  lower_body: [
    "trouser", "trousers", "pant", "pants", "chino", "chinos", "jean",
    "jeans", "short", "shorts", "skirt", "legging", "leggings", "jogger",
  ],
  upper_body: [
    "shirt", "tee", "t-shirt", "polo", "sweater", "jumper", "hoodie",
    "jacket", "coat", "blazer", "cardigan", "sweatshirt", "pullover",
    "vest", "gilet", "overshirt", "parka",
  ],
  dresses: ["dress", "gown", "jumpsuit", "romper"],
};

const ACCESSORY_KEYWORDS: Record<Exclude<AccessoryType, "other">, string[]> = {
  sunglasses: ["sunglass", "sunglasses", "shades", "eyewear"],
  hat: ["hat", "cap", "beanie", "beret", "fedora", "bucket"],
  watch: ["watch", "timepiece", "chronograph"],
  belt: ["belt"],
  tie: ["tie", "necktie", "bow tie"],
  scarf: ["scarf", "shawl"],
};

function classify(
  title: string,
  url: string
): { category: GarmentCategory; accessory_type: AccessoryType | null } {
  const haystack = `${title} ${url}`.toLowerCase();
  for (const [type, words] of Object.entries(ACCESSORY_KEYWORDS)) {
    if (words.some((w) => haystack.includes(w))) {
      return { category: "accessories", accessory_type: type as AccessoryType };
    }
  }
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => haystack.includes(w))) {
      return { category: cat as GarmentCategory, accessory_type: null };
    }
  }
  return { category: "upper_body", accessory_type: null };
}

/** Extract the first meta-tag content attribute matching a property/name. */
function extractMeta(html: string, key: string, value: string): string | null {
  // Handles: <meta property="og:image" content="...">  and reverse attribute order
  const patterns = [
    new RegExp(
      `<meta[^>]+${key}=["']${value}["'][^>]*content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*${key}=["']${value}["']`,
      "i"
    ),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return decodeEntities(m[1]);
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, "/");
}

type JsonLdNode = Record<string, unknown>;

function extractJsonLdProducts(html: string): JsonLdNode[] {
  const products: JsonLdNode[] = [];
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      collectProducts(data, products);
    } catch {
      // some sites emit comma-separated or HTML-escaped JSON; give up on this block
    }
  }
  return products;
}

function collectProducts(node: unknown, out: JsonLdNode[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectProducts(item, out);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as JsonLdNode;
  const type = obj["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
    out.push(obj);
  }
  if (obj["@graph"]) collectProducts(obj["@graph"], out);
}

function readJsonLdString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : "";
  if (v && typeof v === "object") {
    const name = (v as JsonLdNode).name;
    if (typeof name === "string") return name;
  }
  return "";
}

function readPrice(offers: unknown): string {
  if (!offers) return "";
  const first = Array.isArray(offers) ? offers[0] : offers;
  if (!first || typeof first !== "object") return "";
  const o = first as JsonLdNode;
  const price =
    typeof o.price === "string" || typeof o.price === "number"
      ? String(o.price)
      : "";
  if (!price) return "";
  const currency =
    typeof o.priceCurrency === "string" ? `${o.priceCurrency} ` : "";
  return `${currency}${price}`.trim();
}

async function scrape(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  let image_url = extractMeta(html, "property", "og:image") ?? "";
  let title = extractMeta(html, "property", "og:title") ?? "";
  let brand = "";
  let price = "";

  for (const product of extractJsonLdProducts(html)) {
    if (!image_url && product.image) {
      const img = product.image;
      if (typeof img === "string") image_url = img;
      else if (Array.isArray(img) && typeof img[0] === "string")
        image_url = img[0];
    }
    if (!title && typeof product.name === "string") title = product.name;
    if (!brand && product.brand) brand = readJsonLdString(product.brand);
    if (!price && product.offers) price = readPrice(product.offers);
  }

  if (!title) {
    const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (t) title = decodeEntities(t[1].trim());
  }

  if (image_url && image_url.startsWith("//")) {
    image_url = `https:${image_url}`;
  } else if (image_url && image_url.startsWith("/")) {
    const base = new URL(url);
    image_url = `${base.origin}${image_url}`;
  }

  const { category, accessory_type } = classify(title, url);

  return {
    image_url,
    title,
    brand,
    price,
    category,
    accessory_type,
    source_url: url,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url =
    body && typeof body === "object" && "url" in body
      ? (body as { url: unknown }).url
      : null;
  if (typeof url !== "string" || !url.trim()) {
    return Response.json({ error: "Missing `url` field" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const result = await scrape(url);
    if (!result.image_url) {
      return Response.json(
        { error: "Could not find a product image on that page" },
        { status: 422 }
      );
    }
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: `Failed to scrape page: ${message}` },
      { status: 500 }
    );
  }
}
