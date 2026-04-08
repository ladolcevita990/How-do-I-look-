export interface PhotoUploadResponse {
  photo_id: string;
  status: string;
}

export interface PhotoStatus {
  photo_id: string;
  status: string;
  resized_url: string | null;
}

export type GarmentCategory =
  | "upper_body"
  | "lower_body"
  | "dresses"
  | "shoes"
  | "accessories";

export type AccessoryType =
  | "sunglasses"
  | "hat"
  | "watch"
  | "belt"
  | "tie"
  | "scarf"
  | "other";

export interface GarmentResponse {
  id: string;
  name: string;
  brand: string;
  category: GarmentCategory;
  accessory_type: AccessoryType | null;
  source: string;
  original_url: string;
  processed_url: string | null;
  metadata: Record<string, string>;
  created_at: string;
}

export interface GarmentPreview {
  image_data_url: string;
  title: string;
  brand: string;
  price: string;
  category: GarmentCategory;
  accessory_type: AccessoryType | null;
  source_url: string;
}

export interface GarmentSearchResult {
  title: string;
  brand: string;
  image_url: string;
  product_url: string;
  price: string;
}

export interface TryOnResponse {
  job_id: string;
  status: string;
}

export interface TryOnStatus {
  job_id: string;
  status: "queued" | "processing" | "complete" | "failed";
  result_url: string | null;
  error: string | null;
}

export interface OutfitItem {
  garment_id: string;
  category: GarmentCategory;
  accessory_type?: AccessoryType | null;
}

export interface OutfitResponse {
  job_id: string;
  status: string;
}

export interface OutfitStatus {
  job_id: string;
  status: "queued" | "processing" | "complete" | "failed";
  result_url: string | null;
  intermediate_urls: string[];
  error: string | null;
}

export interface SavedOutfit {
  id: string;
  share_id: string;
  name: string;
  result_url: string | null;
  created_at: string;
  items?: {
    garment_id: string;
    category: GarmentCategory;
    accessory_type: AccessoryType | null;
  }[];
}

export interface SessionState {
  session_id: string;
  photo: {
    photo_id: string;
    resized_url: string;
    created_at: string;
  } | null;
  garments: Array<{
    id: string;
    name: string;
    brand: string;
    category: GarmentCategory;
    accessory_type: AccessoryType | null;
    processed_url: string | null;
  }>;
  outfits: SavedOutfit[];
}
