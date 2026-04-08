"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearSession,
  getFileUrl,
  listSavedOutfits,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { SavedOutfit } from "@/lib/types";

export default function LookbookPage() {
  const router = useRouter();
  const hydrated = useAppStore((s) => s.hydrated);
  const closet = useAppStore((s) => s.closet);
  const setCloset = useAppStore((s) => s.setCloset);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const items = await listSavedOutfits();
        setOutfits(items);
      } catch {
        // ignore
      }
    })();
  }, [hydrated]);

  const handleClear = async () => {
    if (
      !confirm(
        "Clear your session? This deletes your photo, closet, and saved outfits on this device. This can't be undone."
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await clearSession();
      setCloset([]);
      setOutfits([]);
      useAppStore.getState().clearPhoto();
      useAppStore.getState().clearOutfit();
      router.push("/");
    } finally {
      setClearing(false);
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
        <div className="flex gap-3 text-sm">
          <button
            onClick={() => router.push("/catalog")}
            className="text-neutral-600 hover:text-neutral-900"
          >
            Build outfit
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-serif font-semibold text-neutral-900">
              Your lookbook
            </h1>
            <p className="text-neutral-500 mt-2 max-w-xl">
              Everything you&apos;ve saved on this device. Items stay here for
              up to a year so you can come back any time.
            </p>
          </div>
          <button
            onClick={handleClear}
            disabled={clearing}
            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear session"}
          </button>
        </div>

        {/* Saved looks */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-neutral-900">
            Saved looks
          </h2>
          {outfits.length === 0 ? (
            <div className="text-neutral-500 text-sm border border-dashed border-neutral-300 rounded-xl p-8 text-center">
              No saved looks yet. Build an outfit and hit{" "}
              <span className="font-medium">Save to lookbook</span>.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {outfits.map((o) => (
                <a
                  key={o.id}
                  href={`/o/${o.share_id}`}
                  className="group bg-white rounded-xl overflow-hidden border border-neutral-200 hover:shadow-md transition-all"
                >
                  <div className="aspect-[3/4] bg-neutral-100 relative">
                    {o.result_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getFileUrl(o.result_url)}
                        alt={o.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {o.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Closet */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-neutral-900">
            Closet ({closet.length})
          </h2>
          {closet.length === 0 ? (
            <div className="text-neutral-500 text-sm border border-dashed border-neutral-300 rounded-xl p-8 text-center">
              Your closet is empty. Add items from{" "}
              <button
                onClick={() => router.push("/catalog")}
                className="underline"
              >
                the catalog
              </button>
              .
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {closet.map((g) => (
                <div
                  key={g.id}
                  className="bg-white rounded-lg border border-neutral-200 aspect-square relative overflow-hidden"
                  title={`${g.name}${g.brand ? " — " + g.brand : ""}`}
                >
                  {g.processed_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getFileUrl(g.processed_url)}
                      alt={g.name}
                      className="absolute inset-0 w-full h-full object-contain p-2"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-neutral-400 text-center pt-6 border-t border-neutral-200">
          Everything here is scoped to this browser via a signed cookie. No
          account, no email, no password.
        </p>
      </div>
    </main>
  );
}
