"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TryOnResult from "@/components/TryOnResult";
import { saveOutfit } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function TryOnPage() {
  const router = useRouter();

  const hydrated = useAppStore((s) => s.hydrated);
  const photoUrl = useAppStore((s) => s.photoUrl);
  const resultUrl = useAppStore((s) => s.resultUrl);
  const resultBlob = useAppStore((s) => s.resultBlob);
  const resultItems = useAppStore((s) => s.resultItems);
  const resultLoading = useAppStore((s) => s.resultLoading);
  const addSavedOutfit = useAppStore((s) => s.addSavedOutfit);

  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // If the user lands on this page directly (no blob in memory), bounce
  // back to the builder.
  useEffect(() => {
    if (!hydrated) return;
    if (!photoUrl) {
      router.push("/upload");
      return;
    }
    if (!resultUrl && !resultLoading) {
      router.push("/catalog");
    }
  }, [hydrated, photoUrl, resultUrl, resultLoading, router]);

  if (!hydrated || !photoUrl) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-500 text-sm">
        Loading…
      </main>
    );
  }

  const handleSave = async () => {
    if (!resultBlob) return;
    setSaving(true);
    setSaveError(null);
    try {
      const o = await saveOutfit(resultBlob, saveName || "Untitled look", resultItems);
      addSavedOutfit(o);
      setSaved(true);
      if (typeof window !== "undefined") {
        setShareUrl(`${window.location.origin}/o/${o.share_id}`);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save outfit");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // ignore
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
          <span className="px-3 py-1">2. Pick items</span>
          <span className="bg-neutral-900 text-white px-3 py-1 rounded-full font-medium">
            3. Try on
          </span>
        </div>
        <button
          onClick={() => router.push("/lookbook")}
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          Lookbook
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-neutral-900">
            Your look
          </h2>
          <p className="text-neutral-600">
            {resultLoading
              ? "Compositing your outfit…"
              : resultUrl
                ? "Slide to compare with the original"
                : "Something went wrong"}
          </p>
        </div>

        <TryOnResult
          originalUrl={photoUrl}
          resultUrl={resultUrl}
          loading={resultLoading && !resultUrl}
        />

        {!resultLoading && resultUrl && !saved && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wide">
              Save to lookbook
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Name this look (optional)"
                className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <button
                onClick={handleSave}
                disabled={saving || !resultBlob}
                className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {saveError && (
              <p className="text-xs text-red-600">{saveError}</p>
            )}
          </div>
        )}

        {saved && shareUrl && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
            <p className="text-sm font-medium text-neutral-900">
              Saved to your lookbook.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-sm bg-neutral-50 text-neutral-600"
              />
              <button
                onClick={handleCopyShare}
                className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800"
              >
                Copy link
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => router.push("/catalog")}
            className="px-6 py-2.5 bg-white border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-100 transition-colors"
          >
            Edit outfit
          </button>
          <button
            onClick={() => router.push("/lookbook")}
            className="px-6 py-2.5 bg-white border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-100 transition-colors"
          >
            Lookbook
          </button>
        </div>
      </div>
    </main>
  );
}
