"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSharedOutfit } from "@/lib/api";
import type { SavedOutfit } from "@/lib/types";

export default function SharedOutfitPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = use(params);
  const router = useRouter();
  const [outfit, setOutfit] = useState<SavedOutfit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const o = await getSharedOutfit(shareId);
        setOutfit(o);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Outfit not found");
      }
    })();
  }, [shareId]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <nav className="bg-white border-b border-neutral-200 px-4 md:px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="text-lg font-bold text-neutral-900"
        >
          How Do I Look?
        </button>
        <button
          onClick={() => router.push("/upload")}
          className="text-sm font-medium bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-800"
        >
          Try it yourself
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {error && (
          <div className="text-center text-neutral-500 py-20">{error}</div>
        )}
        {outfit && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-neutral-900">
                {outfit.name}
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Shared look · {new Date(outfit.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              {outfit.result_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={outfit.result_url}
                  alt={outfit.name}
                  className="w-full object-contain"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
