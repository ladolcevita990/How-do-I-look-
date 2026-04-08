import { create } from "zustand";
import type {
  AccessoryType,
  GarmentCategory,
  GarmentResponse,
  OutfitItem,
  SavedOutfit,
  SessionState,
} from "./types";

// Core outfit shape used by the builder. Single slot for top/bottom/dress/
// shoes; a list for accessories so users can stack sunglasses + hat + watch.
export interface OutfitSlots {
  upper_body: GarmentResponse | null;
  lower_body: GarmentResponse | null;
  dresses: GarmentResponse | null;
  shoes: GarmentResponse | null;
  accessories: GarmentResponse[];
}

const EMPTY_SLOTS: OutfitSlots = {
  upper_body: null,
  lower_body: null,
  dresses: null,
  shoes: null,
  accessories: [],
};

interface AppState {
  // ---- session ----
  sessionId: string | null;
  hydrated: boolean;
  hydrate: (state: SessionState) => void;

  // ---- photo ----
  photoId: string | null;
  photoUrl: string | null;
  setPhoto: (id: string, url: string) => void;
  clearPhoto: () => void;

  // ---- closet (all garments the user has onboarded) ----
  closet: GarmentResponse[];
  addGarment: (garment: GarmentResponse) => void;
  setCloset: (items: GarmentResponse[]) => void;

  // ---- outfit in progress ----
  outfitSlots: OutfitSlots;
  setSlot: (category: GarmentCategory, garment: GarmentResponse) => void;
  removeSlot: (category: GarmentCategory) => void;
  toggleAccessory: (garment: GarmentResponse) => void;
  clearOutfit: () => void;
  getOutfitItems: () => OutfitItem[];

  // ---- history for undo ----
  history: OutfitSlots[];
  pushHistory: () => void;
  undo: () => void;

  // ---- saved outfits ----
  savedOutfits: SavedOutfit[];
  setSavedOutfits: (outfits: SavedOutfit[]) => void;
  addSavedOutfit: (outfit: SavedOutfit) => void;

  // ---- try-on result ----
  resultUrl: string | null;
  resultLoading: boolean;
  setResult: (url: string | null) => void;
  setResultLoading: (loading: boolean) => void;
}

function cloneSlots(s: OutfitSlots): OutfitSlots {
  return { ...s, accessories: [...s.accessories] };
}

export const useAppStore = create<AppState>((set, get) => ({
  sessionId: null,
  hydrated: false,
  hydrate: (state) =>
    set({
      sessionId: state.session_id,
      hydrated: true,
      photoId: state.photo?.photo_id || null,
      photoUrl: state.photo?.resized_url || null,
      closet: state.garments.map((g) => ({
        id: g.id,
        name: g.name,
        brand: g.brand,
        category: g.category,
        accessory_type: g.accessory_type,
        source: "",
        original_url: "",
        processed_url: g.processed_url,
        metadata: {},
        created_at: "",
      })),
      savedOutfits: state.outfits,
    }),

  photoId: null,
  photoUrl: null,
  setPhoto: (id, url) => set({ photoId: id, photoUrl: url }),
  clearPhoto: () => set({ photoId: null, photoUrl: null }),

  closet: [],
  addGarment: (garment) =>
    set((state) => ({
      closet: [garment, ...state.closet.filter((g) => g.id !== garment.id)],
    })),
  setCloset: (items) => set({ closet: items }),

  outfitSlots: EMPTY_SLOTS,
  setSlot: (category, garment) => {
    const prev = cloneSlots(get().outfitSlots);
    set((state) => ({
      history: [...state.history.slice(-19), prev],
      outfitSlots:
        category === "accessories"
          ? { ...state.outfitSlots, accessories: [garment] }
          : { ...state.outfitSlots, [category]: garment },
    }));
  },
  removeSlot: (category) => {
    const prev = cloneSlots(get().outfitSlots);
    set((state) => ({
      history: [...state.history.slice(-19), prev],
      outfitSlots:
        category === "accessories"
          ? { ...state.outfitSlots, accessories: [] }
          : { ...state.outfitSlots, [category]: null },
    }));
  },
  toggleAccessory: (garment) => {
    const prev = cloneSlots(get().outfitSlots);
    set((state) => {
      const existing = state.outfitSlots.accessories;
      const alreadyIn = existing.some((g) => g.id === garment.id);
      const next = alreadyIn
        ? existing.filter((g) => g.id !== garment.id)
        : [...existing, garment];
      return {
        history: [...state.history.slice(-19), prev],
        outfitSlots: { ...state.outfitSlots, accessories: next },
      };
    });
  },
  clearOutfit: () => {
    const prev = cloneSlots(get().outfitSlots);
    set((state) => ({
      history: [...state.history.slice(-19), prev],
      outfitSlots: { ...EMPTY_SLOTS, accessories: [] },
    }));
  },
  getOutfitItems: () => {
    const s = get().outfitSlots;
    const items: OutfitItem[] = [];
    if (s.upper_body)
      items.push({ garment_id: s.upper_body.id, category: "upper_body" });
    if (s.lower_body)
      items.push({ garment_id: s.lower_body.id, category: "lower_body" });
    if (s.dresses) items.push({ garment_id: s.dresses.id, category: "dresses" });
    if (s.shoes) items.push({ garment_id: s.shoes.id, category: "shoes" });
    for (const acc of s.accessories) {
      items.push({
        garment_id: acc.id,
        category: "accessories",
        accessory_type: (acc.accessory_type as AccessoryType | null) ?? null,
      });
    }
    return items;
  },

  history: [],
  pushHistory: () =>
    set((state) => ({
      history: [...state.history.slice(-19), cloneSlots(state.outfitSlots)],
    })),
  undo: () =>
    set((state) => {
      if (state.history.length === 0) return {};
      const next = state.history[state.history.length - 1];
      return {
        history: state.history.slice(0, -1),
        outfitSlots: cloneSlots(next),
      };
    }),

  savedOutfits: [],
  setSavedOutfits: (outfits) => set({ savedOutfits: outfits }),
  addSavedOutfit: (outfit) =>
    set((state) => ({ savedOutfits: [outfit, ...state.savedOutfits] })),

  resultUrl: null,
  resultLoading: false,
  setResult: (url) => set({ resultUrl: url, resultLoading: false }),
  setResultLoading: (loading) => set({ resultLoading: loading }),
}));
