"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GarmentSearch from "@/components/GarmentSearch";
import OutfitBuilder from "@/components/OutfitBuilder";
import { useAppStore } from "@/lib/store";
import { createOutfit } from "@/lib/api";

export default function CatalogPage() {
  const router = useRouter();
  const photoId = useAppStore((s) => s.photoId);
  const hydrated = useAppStore((s) => s.hydrated);
  const getOutfitItems = useAppStore((s) => s.getOutfitItems);
  const setResultLoading = useAppStore((s) => s.setResultLoading);
  const [loading, setLoading] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  // Only redirect once the session has actually finished hydrating — otherwise
  // returning users would briefly bounce back to /upload before we know they
  // already have a photo.
  useEffect(() => {
    if (hydrated && !photoId) {
      router.push("/upload");
    }
  }, [hydrated, photoId, router]);

  if (!hydrated || !photoId) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-500 text-sm">
        Loading…
      </main>
    );
  }

  const handleTryOn = async () => {
    const items = getOutfitItems();
    if (items.length === 0) return;

    setLoading(true);
    setResultLoading(true);
    try {
      const res = await createOutfit(photoId, items);
      setLastJobId(res.job_id);
      router.push(`/tryon?job=${res.job_id}`);
    } catch {
      setLoading(false);
      setResultLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => router.push("/")}
          className="text-lg font-bold text-neutral-900"
        >
          How Do I Look?
        </button>
        <div className="hidden md:flex gap-2 text-sm text-neutral-500">
          <span className="px-3 py-1">1. Upload</span>
          <span className="bg-neutral-900 text-white px-3 py-1 rounded-full font-medium">
            2. Pick items
          </span>
          <span className="px-3 py-1">3. Try on</span>
        </div>
        <button
          onClick={() => router.push("/lookbook")}
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          Lookbook
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 pb-40 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-bold text-neutral-900">
              Build your look
            </h2>
            <p className="text-neutral-600">
              Paste any product URL from any brand, or upload an image
              directly. Mix clothing, shoes, and accessories into one outfit.
            </p>
            <GarmentSearch />
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              <OutfitBuilder
                onTryOn={handleTryOn}
                loading={loading}
                lastJobId={lastJobId}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 shadow-[0_-8px_32px_rgba(0,0,0,0.08)] max-h-[60vh] overflow-y-auto z-20">
        <div className="p-3">
          <OutfitBuilder
            onTryOn={handleTryOn}
            loading={loading}
            lastJobId={lastJobId}
          />
        </div>
      </div>
    </main>
  );
}
