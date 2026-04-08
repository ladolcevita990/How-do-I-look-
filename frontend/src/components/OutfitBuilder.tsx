"use client";

import Image from "next/image";
import type { GarmentCategory, GarmentResponse } from "@/lib/types";
import { useAppStore } from "@/lib/store";

type Slot = {
  key: Exclude<GarmentCategory, "accessories">;
  label: string;
  icon: string;
};

const SLOTS: Slot[] = [
  { key: "upper_body", label: "Top", icon: "👔" },
  { key: "dresses", label: "Dress", icon: "👗" },
  { key: "lower_body", label: "Bottom", icon: "👖" },
  { key: "shoes", label: "Shoes", icon: "👟" },
];

function GarmentThumb({
  garment,
  onRemove,
}: {
  garment: GarmentResponse;
  onRemove: () => void;
}) {
  const url = garment.processed_url || "";
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white border border-neutral-200 flex-shrink-0">
        {url.startsWith("http") ? (
          <Image
            src={url}
            alt={garment.name}
            fill
            className="object-contain p-0.5"
            sizes="40px"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 truncate">
          {garment.name}
        </p>
        {garment.brand && (
          <p className="text-xs text-neutral-500 truncate">{garment.brand}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="text-neutral-400 hover:text-red-500 p-1"
        aria-label="Remove"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export default function OutfitBuilder({
  onTryOn,
  loading,
}: {
  onTryOn: () => void;
  loading: boolean;
}) {
  const outfitSlots = useAppStore((s) => s.outfitSlots);
  const removeSlot = useAppStore((s) => s.removeSlot);
  const toggleAccessory = useAppStore((s) => s.toggleAccessory);
  const clearOutfit = useAppStore((s) => s.clearOutfit);
  const history = useAppStore((s) => s.history);
  const undo = useAppStore((s) => s.undo);

  const filled =
    (outfitSlots.upper_body ? 1 : 0) +
    (outfitSlots.lower_body ? 1 : 0) +
    (outfitSlots.dresses ? 1 : 0) +
    (outfitSlots.shoes ? 1 : 0) +
    outfitSlots.accessories.length;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900">Your outfit</h3>
        <div className="flex gap-3 text-xs">
          {history.length > 0 && (
            <button
              onClick={undo}
              className="text-neutral-500 hover:text-neutral-900"
            >
              Undo
            </button>
          )}
          {filled > 0 && (
            <button
              onClick={clearOutfit}
              className="text-red-500 hover:text-red-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {SLOTS.map(({ key, label, icon }) => {
          const garment = outfitSlots[key];
          return (
            <div
              key={key}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                garment ? "bg-neutral-100" : "bg-neutral-50"
              }`}
            >
              <span className="text-lg w-8 text-center">{icon}</span>
              {garment ? (
                <GarmentThumb
                  garment={garment}
                  onRemove={() => removeSlot(key)}
                />
              ) : (
                <p className="text-sm text-neutral-400 flex-1">{label}</p>
              )}
            </div>
          );
        })}

        {/* Accessories — multiple allowed */}
        <div className="rounded-lg bg-neutral-50 p-2 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-lg w-8 text-center">👓</span>
            <p className="text-sm text-neutral-500 flex-1">
              Accessories
              {outfitSlots.accessories.length > 0
                ? ` (${outfitSlots.accessories.length})`
                : ""}
            </p>
          </div>
          {outfitSlots.accessories.length > 0 && (
            <div className="space-y-1.5 pl-11">
              {outfitSlots.accessories.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 p-1.5 rounded-lg bg-white border border-neutral-200"
                >
                  <GarmentThumb
                    garment={g}
                    onRemove={() => toggleAccessory(g)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onTryOn}
        disabled={filled === 0 || loading}
        className="w-full py-3 px-4 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Generating…
          </span>
        ) : (
          `Try on outfit (${filled} item${filled !== 1 ? "s" : ""})`
        )}
      </button>

    </div>
  );
}
