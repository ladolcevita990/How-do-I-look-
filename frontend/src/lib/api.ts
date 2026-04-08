import type {
  AccessoryType,
  GarmentCategory,
  GarmentPreview,
  GarmentResponse,
  GarmentSearchResult,
  OutfitItem,
  OutfitResponse,
  OutfitStatus,
  PhotoUploadResponse,
  SavedOutfit,
  SessionState,
  TryOnResponse,
  TryOnStatus,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // Always send cookies so /api/session and session-scoped endpoints work.
    credentials: "include",
    headers: {
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// ---- session -------------------------------------------------------------

export async function ensureSession(): Promise<{
  session_id: string;
  returning: boolean;
}> {
  return fetchApi("/api/session");
}

export async function getSessionState(): Promise<SessionState> {
  return fetchApi<SessionState>("/api/session/state");
}

export async function clearSession(): Promise<{ session_id: string }> {
  return fetchApi("/api/session", { method: "DELETE" });
}

// ---- photo ---------------------------------------------------------------

export async function uploadPhoto(file: File): Promise<PhotoUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi<PhotoUploadResponse>("/api/upload", {
    method: "POST",
    body: formData,
  });
}

// ---- garments ------------------------------------------------------------

export async function previewGarmentFromUrl(
  url: string
): Promise<GarmentPreview> {
  return fetchApi<GarmentPreview>("/api/garments/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function confirmGarmentFromUrl(
  url: string,
  category: GarmentCategory,
  accessory_type: AccessoryType | null,
  name?: string,
  brand?: string
): Promise<GarmentResponse> {
  return fetchApi<GarmentResponse>("/api/garments/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      category,
      accessory_type,
      name: name || "",
      brand: brand || "",
    }),
  });
}

export async function searchGarments(
  query: string,
  category?: string
): Promise<GarmentSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (category) params.set("category", category);
  return fetchApi<GarmentSearchResult[]>(`/api/garments/search?${params}`);
}

export async function uploadGarment(
  file: File,
  name: string,
  brand: string,
  category: GarmentCategory,
  accessory_type: AccessoryType | null
): Promise<GarmentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  formData.append("brand", brand);
  formData.append("category", category);
  if (accessory_type) formData.append("accessory_type", accessory_type);
  return fetchApi<GarmentResponse>("/api/garments/upload", {
    method: "POST",
    body: formData,
  });
}

export async function listGarments(
  category?: string
): Promise<GarmentResponse[]> {
  const params = category ? `?category=${category}` : "";
  return fetchApi<GarmentResponse[]>(`/api/garments${params}`);
}

// ---- try-on --------------------------------------------------------------

export async function createTryOn(
  photoId: string,
  garmentId: string
): Promise<TryOnResponse> {
  return fetchApi<TryOnResponse>("/api/tryon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo_id: photoId, garment_id: garmentId }),
  });
}

export async function getTryOnStatus(jobId: string): Promise<TryOnStatus> {
  return fetchApi<TryOnStatus>(`/api/tryon/${jobId}`);
}

// ---- outfit --------------------------------------------------------------

export async function createOutfit(
  photoId: string,
  garments: OutfitItem[]
): Promise<OutfitResponse> {
  return fetchApi<OutfitResponse>("/api/outfit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo_id: photoId, garments }),
  });
}

export async function getOutfitStatus(jobId: string): Promise<OutfitStatus> {
  return fetchApi<OutfitStatus>(`/api/outfit/${jobId}`);
}

export async function saveOutfit(
  jobId: string,
  name: string
): Promise<SavedOutfit> {
  return fetchApi<SavedOutfit>(`/api/outfits/${jobId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function listSavedOutfits(): Promise<SavedOutfit[]> {
  return fetchApi<SavedOutfit[]>("/api/outfits");
}

export async function getSharedOutfit(shareId: string): Promise<SavedOutfit> {
  return fetchApi<SavedOutfit>(`/api/outfits/share/${shareId}`);
}

// ---- file URLs -----------------------------------------------------------

export function getFileUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  return `${API_URL}${path}`;
}
