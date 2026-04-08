"use client";

/**
 * Client-side data layer for How Do I Look?.
 *
 * There is no Python backend. Everything runs in the browser:
 *   - Photos, garments, and outfits live in Supabase (Postgres + Storage).
 *   - Background removal runs on-device via @imgly/background-removal.
 *   - Outfit compositing runs in a <canvas> via lib/tryon/composite.ts.
 *   - The garment URL scraper is the only server code and runs as a
 *     Next.js Route Handler at /api/scrape so it bypasses browser CORS.
 *
 * Function names match the old fetch-based API so pages barely change.
 */

import type {
  AccessoryType,
  GarmentCategory,
  GarmentPreview,
  GarmentResponse,
  OutfitItem,
  SavedOutfit,
  SessionState,
} from "./types";
import {
  SUPABASE_BUCKET,
  clearSessionId,
  getOrCreateSessionId,
  publicUrl,
  supabase,
} from "./supabase";
import { removeBackground } from "./tryon/bgremove";
import {
  composeOutfit,
  loadImage,
  type CompositeLayer,
} from "./tryon/composite";

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function ensureSession(): Promise<{
  session_id: string;
  returning: boolean;
}> {
  const id = getOrCreateSessionId();
  // We can't tell "returning" for certain without hitting the db, so we infer
  // it from whether the session has any photos/garments/outfits.
  const [photos, garments, outfits] = await Promise.all([
    supabase().from("photos").select("id").eq("session_id", id).limit(1),
    supabase().from("garments").select("id").eq("session_id", id).limit(1),
    supabase().from("outfits").select("id").eq("session_id", id).limit(1),
  ]);
  const returning = Boolean(
    (photos.data && photos.data.length) ||
      (garments.data && garments.data.length) ||
      (outfits.data && outfits.data.length)
  );
  return { session_id: id, returning };
}

interface PhotoRow {
  id: string;
  session_id: string;
  storage_path: string;
  created_at: string;
}

interface GarmentRow {
  id: string;
  session_id: string;
  name: string;
  brand: string;
  category: GarmentCategory;
  accessory_type: AccessoryType | null;
  storage_path: string;
  source_url: string | null;
  created_at: string;
}

interface OutfitRow {
  id: string;
  session_id: string;
  share_id: string;
  name: string;
  storage_path: string | null;
  created_at: string;
}

interface OutfitItemRow {
  id: string;
  outfit_id: string;
  garment_id: string;
  category: GarmentCategory;
  accessory_type: AccessoryType | null;
}

function garmentRowToResponse(row: GarmentRow): GarmentResponse {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    accessory_type: row.accessory_type,
    source: row.source_url ? "url" : "upload",
    original_url: row.source_url || "",
    processed_url: publicUrl(row.storage_path),
    metadata: {},
    created_at: row.created_at,
  };
}

export async function getSessionState(): Promise<SessionState> {
  const sessionId = getOrCreateSessionId();
  const client = supabase();

  const [photoRes, garmentRes, outfitRes] = await Promise.all([
    client
      .from("photos")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("garments")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false }),
    client
      .from("outfits")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false }),
  ]);

  const photoRow = photoRes.data as PhotoRow | null;
  const garmentRows = (garmentRes.data || []) as GarmentRow[];
  const outfitRows = (outfitRes.data || []) as OutfitRow[];

  return {
    session_id: sessionId,
    photo: photoRow
      ? {
          photo_id: photoRow.id,
          resized_url: publicUrl(photoRow.storage_path),
          created_at: photoRow.created_at,
        }
      : null,
    garments: garmentRows.map((g) => ({
      id: g.id,
      name: g.name,
      brand: g.brand,
      category: g.category,
      accessory_type: g.accessory_type,
      processed_url: publicUrl(g.storage_path),
    })),
    outfits: outfitRows.map((o) => ({
      id: o.id,
      share_id: o.share_id,
      name: o.name,
      result_url: publicUrl(o.storage_path),
      created_at: o.created_at,
    })),
  };
}

export async function clearSession(): Promise<{ session_id: string }> {
  const oldId = getOrCreateSessionId();
  const client = supabase();

  // Delete storage objects for this session.
  const prefix = `sessions/${oldId}`;
  const { data: list } = await client.storage.from(SUPABASE_BUCKET).list(prefix, {
    limit: 1000,
  });
  if (list && list.length > 0) {
    const paths = list.map((entry) => `${prefix}/${entry.name}`);
    await client.storage.from(SUPABASE_BUCKET).remove(paths);
  }
  // Also walk subfolders (photos/, garments/, outfits/).
  for (const sub of ["photos", "garments", "outfits"]) {
    const subPrefix = `${prefix}/${sub}`;
    const { data: subList } = await client.storage
      .from(SUPABASE_BUCKET)
      .list(subPrefix, { limit: 1000 });
    if (subList && subList.length > 0) {
      await client.storage
        .from(SUPABASE_BUCKET)
        .remove(subList.map((e) => `${subPrefix}/${e.name}`));
    }
  }

  // Delete rows. outfit_items cascades off outfits.
  await client.from("outfits").delete().eq("session_id", oldId);
  await client.from("garments").delete().eq("session_id", oldId);
  await client.from("photos").delete().eq("session_id", oldId);

  const newId = clearSessionId();
  return { session_id: newId };
}

// ---------------------------------------------------------------------------
// Photo
// ---------------------------------------------------------------------------

export async function uploadPhoto(
  file: File
): Promise<{ photo_id: string; status: string; resized_url: string }> {
  const sessionId = getOrCreateSessionId();
  const client = supabase();

  // Resize to max 1280px on long edge for speed + storage hygiene.
  const resized = await resizeImage(file, 1280);
  const ext = resized.type === "image/png" ? "png" : "jpg";
  const id = crypto.randomUUID();
  const path = `sessions/${sessionId}/photos/${id}.${ext}`;

  const uploadRes = await client.storage
    .from(SUPABASE_BUCKET)
    .upload(path, resized, {
      contentType: resized.type,
      upsert: false,
    });
  if (uploadRes.error) throw new Error(uploadRes.error.message);

  const insertRes = await client
    .from("photos")
    .insert({ id, session_id: sessionId, storage_path: path })
    .select()
    .single();
  if (insertRes.error) throw new Error(insertRes.error.message);

  return {
    photo_id: id,
    status: "ready",
    resized_url: publicUrl(path),
  };
}

async function resizeImage(file: File, maxDim: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  if (scale >= 1) {
    bitmap.close();
    return file;
  }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode resized photo"));
      },
      "image/jpeg",
      0.92
    );
  });
}

// ---------------------------------------------------------------------------
// Garments
// ---------------------------------------------------------------------------

// Blob cache so the confirm step can reuse the background-removed image from
// the preview step without re-running the model.
const previewBlobs = new Map<string, Blob>();

export async function previewGarmentFromUrl(
  url: string
): Promise<GarmentPreview> {
  const scrapeRes = await fetch("/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!scrapeRes.ok) {
    const err = await scrapeRes.json().catch(() => ({
      error: scrapeRes.statusText,
    }));
    throw new Error(err.error || "Could not read that page");
  }
  const scraped: {
    image_url: string;
    title: string;
    brand: string;
    price: string;
    category: GarmentCategory;
    accessory_type: AccessoryType | null;
    source_url: string;
  } = await scrapeRes.json();

  if (!scraped.image_url) {
    throw new Error("Could not find a product image on that page");
  }

  // Download the image via our own endpoint to dodge CORS.
  const imgProxy = await fetch(
    `/api/scrape/image?url=${encodeURIComponent(scraped.image_url)}`
  );
  if (!imgProxy.ok) {
    throw new Error("Could not download the product image");
  }
  const rawBlob = await imgProxy.blob();

  // Background removal runs in the browser. This can take ~10s on first run
  // while the model downloads.
  const processed = await removeBackground(rawBlob);
  previewBlobs.set(url, processed);

  const dataUrl = await blobToDataUrl(processed);
  return {
    image_data_url: dataUrl,
    title: scraped.title,
    brand: scraped.brand,
    price: scraped.price,
    category: scraped.category,
    accessory_type: scraped.accessory_type,
    source_url: scraped.source_url,
  };
}

export async function confirmGarmentFromUrl(
  url: string,
  category: GarmentCategory,
  accessory_type: AccessoryType | null,
  name?: string,
  brand?: string
): Promise<GarmentResponse> {
  const blob = previewBlobs.get(url);
  if (!blob) {
    throw new Error("Preview expired — tap Preview again");
  }
  const garment = await storeGarment({
    blob,
    name: name || "Item",
    brand: brand || "",
    category,
    accessory_type,
    source_url: url,
  });
  previewBlobs.delete(url);
  return garment;
}

export async function uploadGarment(
  file: File,
  name: string,
  brand: string,
  category: GarmentCategory,
  accessory_type: AccessoryType | null
): Promise<GarmentResponse> {
  const processed = await removeBackground(file);
  return storeGarment({
    blob: processed,
    name,
    brand,
    category,
    accessory_type,
    source_url: null,
  });
}

async function storeGarment({
  blob,
  name,
  brand,
  category,
  accessory_type,
  source_url,
}: {
  blob: Blob;
  name: string;
  brand: string;
  category: GarmentCategory;
  accessory_type: AccessoryType | null;
  source_url: string | null;
}): Promise<GarmentResponse> {
  const sessionId = getOrCreateSessionId();
  const client = supabase();
  const id = crypto.randomUUID();
  const path = `sessions/${sessionId}/garments/${id}.png`;

  const uploadRes = await client.storage
    .from(SUPABASE_BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (uploadRes.error) throw new Error(uploadRes.error.message);

  const insertRes = await client
    .from("garments")
    .insert({
      id,
      session_id: sessionId,
      name,
      brand,
      category,
      accessory_type,
      storage_path: path,
      source_url,
    })
    .select()
    .single();
  if (insertRes.error) throw new Error(insertRes.error.message);

  return garmentRowToResponse(insertRes.data as GarmentRow);
}

export async function listGarments(
  category?: string
): Promise<GarmentResponse[]> {
  const sessionId = getOrCreateSessionId();
  let query = supabase()
    .from("garments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (category) query = query.eq("category", category);
  const res = await query;
  if (res.error) throw new Error(res.error.message);
  return (res.data as GarmentRow[]).map(garmentRowToResponse);
}

// ---------------------------------------------------------------------------
// Try-on (pure client-side)
// ---------------------------------------------------------------------------

/**
 * Compose the user's photo with the selected garments entirely in the
 * browser. Returns the rendered JPEG blob — no backend call, no polling.
 */
export async function runTryOn(
  photoUrl: string,
  garments: GarmentResponse[],
  items: OutfitItem[]
): Promise<Blob> {
  const bodyImage = await loadImage(photoUrl);
  const layers: CompositeLayer[] = [];

  for (const item of items) {
    const g = garments.find((x) => x.id === item.garment_id);
    if (!g || !g.processed_url) continue;
    const img = await loadImage(g.processed_url);
    layers.push({
      image: img,
      category: item.category,
      accessoryType: item.accessory_type ?? null,
    });
  }

  return composeOutfit(bodyImage, layers);
}

// ---------------------------------------------------------------------------
// Outfit save + share
// ---------------------------------------------------------------------------

export async function saveOutfit(
  blob: Blob,
  name: string,
  items: OutfitItem[]
): Promise<SavedOutfit> {
  const sessionId = getOrCreateSessionId();
  const client = supabase();
  const id = crypto.randomUUID();
  const path = `sessions/${sessionId}/outfits/${id}.jpg`;

  const uploadRes = await client.storage
    .from(SUPABASE_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (uploadRes.error) throw new Error(uploadRes.error.message);

  const insertRes = await client
    .from("outfits")
    .insert({
      id,
      session_id: sessionId,
      name: name || "Untitled look",
      storage_path: path,
    })
    .select()
    .single();
  if (insertRes.error) throw new Error(insertRes.error.message);
  const outfit = insertRes.data as OutfitRow;

  if (items.length > 0) {
    const itemsRes = await client.from("outfit_items").insert(
      items.map((it) => ({
        outfit_id: id,
        garment_id: it.garment_id,
        category: it.category,
        accessory_type: it.accessory_type ?? null,
      }))
    );
    if (itemsRes.error) throw new Error(itemsRes.error.message);
  }

  return {
    id: outfit.id,
    share_id: outfit.share_id,
    name: outfit.name,
    result_url: publicUrl(outfit.storage_path),
    created_at: outfit.created_at,
    items: items.map((it) => ({
      garment_id: it.garment_id,
      category: it.category,
      accessory_type: it.accessory_type ?? null,
    })),
  };
}

export async function listSavedOutfits(): Promise<SavedOutfit[]> {
  const sessionId = getOrCreateSessionId();
  const res = await supabase()
    .from("outfits")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return (res.data as OutfitRow[]).map((o) => ({
    id: o.id,
    share_id: o.share_id,
    name: o.name,
    result_url: publicUrl(o.storage_path),
    created_at: o.created_at,
  }));
}

export async function getSharedOutfit(shareId: string): Promise<SavedOutfit> {
  const res = await supabase()
    .from("outfits")
    .select("*")
    .eq("share_id", shareId)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) throw new Error("Outfit not found");
  const o = res.data as OutfitRow;

  const itemsRes = await supabase()
    .from("outfit_items")
    .select("*")
    .eq("outfit_id", o.id);
  const itemRows = (itemsRes.data || []) as OutfitItemRow[];

  return {
    id: o.id,
    share_id: o.share_id,
    name: o.name,
    result_url: publicUrl(o.storage_path),
    created_at: o.created_at,
    items: itemRows.map((r) => ({
      garment_id: r.garment_id,
      category: r.category,
      accessory_type: r.accessory_type,
    })),
  };
}

// ---------------------------------------------------------------------------
// File URL helper (kept for backwards compat with components)
// ---------------------------------------------------------------------------

export function getFileUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:"))
    return path;
  return publicUrl(path);
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}
