"use client";

import Image from "next/image";
import { getFileUrl } from "@/lib/api";
import type { GarmentCategory, GarmentResponse } from "@/lib/types";
import { useAppStore } from "@/lib/store";

const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  upper_body: "Top",
  lower_body: "Bottom",
  dresses: "Dress",
  shoes: "Shoes",
  accessories: "Accessory",
};

export default function GarmentCard({
  garment,
}: {
  garment: GarmentResponse;
}) {
  const setSlot = useAppStore((s) => s.setSlot);
  const toggleAccessory = useAppStore((s) => s.toggleAccessory);
  const outfitSlots = useAppStore((s) => s.outfitSlots);

  let isInOutfit = false;
  if (garment.category === "accessories") {
    isInOutfit = outfitSlots.accessories.some((g) => g.id === garment.id);
  } else if (garment.category === "upper_body") {
    isInOutfit = outfitSlots.upper_body?.id === garment.id;
  } else if (garment.category === "lower_body") {
    isInOutfit = outfitSlots.lower_body?.id === garment.id;
  } else if (garment.category === "dresses") {
    isInOutfit = outfitSlots.dresses?.id === garment.id;
  } else if (garment.category === "shoes") {
    isInOutfit = outfitSlots.shoes?.id === garment.id;
  }

  const imageUrl = garment.processed_url
    ? getFileUrl(garment.processed_url)
    : "/placeholder.png";

  const handleAdd = () => {
    if (garment.category === "accessories") {
      toggleAccessory(garment);
    } else {
      setSlot(garment.category, garment);
    }
  };

  return (
    <div
      className={`group relative bg-white rounded-xl border overflow-hidden transition-all hover:shadow-md ${
        isInOutfit ? "border-neutral-900 shadow-md" : "border-neutral-200"
      }`}
    >
      <div className="relative aspect-square bg-neutral-50">
        {imageUrl.startsWith("http") ? (
          <Image
            src={imageUrl}
            alt={garment.name}
            fill
            className="object-contain p-2"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={garment.name}
            className="absolute inset-0 w-full h-full object-contain p-2"
          />
        )}
        <span className="absolute top-2 left-2 text-[10px] font-medium bg-neutral-900/80 text-white px-2 py-0.5 rounded-full">
          {garment.category === "accessories" && garment.accessory_type
            ? garment.accessory_type
            : CATEGORY_LABELS[garment.category]}
        </span>
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-neutral-900 truncate">
          {garment.name}
        </p>
        {garment.brand && (
          <p className="text-xs text-neutral-500 truncate">{garment.brand}</p>
        )}

        <button
          onClick={handleAdd}
          className={`mt-2 w-full py-1.5 px-3 text-sm font-medium rounded-lg transition-colors ${
            isInOutfit
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          {isInOutfit
            ? garment.category === "accessories"
              ? "Remove"
              : "Added"
            : garment.category === "accessories"
            ? "Add"
            : "Add to outfit"}
        </button>
      </div>
    </div>
  );
}
