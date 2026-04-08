"use client";

import { useState } from "react";
import type {
  AccessoryType,
  GarmentCategory,
  GarmentPreview,
} from "@/lib/types";
import {
  confirmGarmentFromUrl,
  previewGarmentFromUrl,
  uploadGarment,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";
import GarmentCard from "./GarmentCard";

type Tab = "url" | "upload" | "closet";

const CATEGORY_OPTIONS: { value: GarmentCategory; label: string }[] = [
  { value: "upper_body", label: "Top" },
  { value: "lower_body", label: "Bottom" },
  { value: "dresses", label: "Dress" },
  { value: "shoes", label: "Shoes" },
  { value: "accessories", label: "Accessory" },
];

const ACCESSORY_OPTIONS: { value: AccessoryType; label: string }[] = [
  { value: "sunglasses", label: "Sunglasses" },
  { value: "hat", label: "Hat" },
  { value: "watch", label: "Watch" },
  { value: "belt", label: "Belt" },
  { value: "tie", label: "Tie" },
  { value: "scarf", label: "Scarf" },
  { value: "other", label: "Other" },
];

export default function GarmentSearch() {
  const closet = useAppStore((s) => s.closet);
  const addGarment = useAppStore((s) => s.addGarment);

  const [tab, setTab] = useState<Tab>("url");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // URL flow
  const [productUrl, setProductUrl] = useState("");
  const [preview, setPreview] = useState<GarmentPreview | null>(null);

  // Upload flow
  const [uploadName, setUploadName] = useState("");
  const [uploadBrand, setUploadBrand] = useState("");
  const [uploadCategory, setUploadCategory] =
    useState<GarmentCategory>("upper_body");
  const [uploadAccType, setUploadAccType] =
    useState<AccessoryType>("sunglasses");

  // ---- URL flow ---------------------------------------------------------

  const handlePreview = async () => {
    if (!productUrl) return;
    setLoading(true);
    setError(null);
    try {
      const p = await previewGarmentFromUrl(productUrl.trim());
      setPreview(p);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't read that page. Try another link or upload an image."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPreview = async (
    category: GarmentCategory,
    accessory_type: AccessoryType | null,
    name: string,
    brand: string
  ) => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const g = await confirmGarmentFromUrl(
        preview.source_url,
        category,
        accessory_type,
        name,
        brand
      );
      addGarment(g);
      setPreview(null);
      setProductUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save garment");
    } finally {
      setLoading(false);
    }
  };

  // ---- Upload flow ------------------------------------------------------

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const g = await uploadGarment(
        file,
        uploadName || "Uploaded item",
        uploadBrand,
        uploadCategory,
        uploadCategory === "accessories" ? uploadAccType : null
      );
      addGarment(g);
      setUploadName("");
      setUploadBrand("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl">
        {(
          [
            { key: "url", label: "Paste URL" },
            { key: "upload", label: "Upload" },
            { key: "closet", label: `My closet (${closet.length})` },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setError(null);
            }}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* URL tab — hero input */}
      {tab === "url" && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Paste any product URL from any brand — Santoni, Aurelien,
            Suitsupply, whatever. We&apos;ll pull the image, remove the
            background, and guess the category.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePreview()}
              placeholder="https://www.suitsupply.com/…"
              className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            />
            <button
              onClick={handlePreview}
              disabled={loading || !productUrl}
              className="px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {loading && !preview ? "Fetching…" : "Preview"}
            </button>
          </div>
        </div>
      )}

      {/* Upload tab */}
      {tab === "upload" && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Got an image of the item already? Drop it in and we&apos;ll strip
            the background.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Item name"
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={uploadBrand}
              onChange={(e) => setUploadBrand(e.target.value)}
              placeholder="Brand"
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={uploadCategory}
              onChange={(e) =>
                setUploadCategory(e.target.value as GarmentCategory)
              }
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {uploadCategory === "accessories" && (
              <select
                value={uploadAccType}
                onChange={(e) =>
                  setUploadAccType(e.target.value as AccessoryType)
                }
                className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ACCESSORY_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            )}
            <label className="flex-1 flex items-center justify-center px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors">
              {loading ? "Uploading…" : "Choose Image"}
              <input
                type="file"
                onChange={handleUpload}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>
        </div>
      )}

      {/* Closet tab — shows nothing of its own, just the grid below */}

      {/* Error */}
      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Closet grid — always visible */}
      {closet.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {closet.map((g) => (
            <GarmentCard key={g.id} garment={g} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-neutral-500 text-sm border border-dashed border-neutral-300 rounded-xl">
          Your closet is empty. Paste a product URL above to add your first
          item.
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <PreviewModal
          preview={preview}
          onCancel={() => setPreview(null)}
          onConfirm={handleConfirmPreview}
          saving={loading}
        />
      )}
    </div>
  );
}

function PreviewModal({
  preview,
  onCancel,
  onConfirm,
  saving,
}: {
  preview: GarmentPreview;
  onCancel: () => void;
  onConfirm: (
    category: GarmentCategory,
    accessory_type: AccessoryType | null,
    name: string,
    brand: string
  ) => void;
  saving: boolean;
}) {
  const [category, setCategory] = useState<GarmentCategory>(preview.category);
  const [accType, setAccType] = useState<AccessoryType>(
    preview.accessory_type || "sunglasses"
  );
  const [name, setName] = useState(preview.title);
  const [brand, setBrand] = useState(preview.brand);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start gap-4 p-5 border-b border-neutral-200">
          <div className="relative w-28 h-28 bg-neutral-100 rounded-xl overflow-hidden flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.image_data_url}
              alt={preview.title}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-900 truncate">
              {preview.title || "Untitled item"}
            </h3>
            {preview.brand && (
              <p className="text-sm text-neutral-500 truncate">
                {preview.brand}
              </p>
            )}
            {preview.price && (
              <p className="text-sm text-neutral-700 mt-1">{preview.price}</p>
            )}
          </div>
        </div>

        <div className="p-5 space-y-3">
          <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wide">
            Category
          </label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  category === c.value
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {category === "accessories" && (
            <>
              <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wide pt-1">
                Accessory type
              </label>
              <div className="flex gap-2 flex-wrap">
                {ACCESSORY_OPTIONS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAccType(a.value)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      accType === a.value
                        ? "bg-indigo-600 text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand"
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 bg-white border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm(
                category,
                category === "accessories" ? accType : null,
                name,
                brand
              )
            }
            disabled={saving}
            className="flex-1 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add to closet"}
          </button>
        </div>
      </div>
    </div>
  );
}
