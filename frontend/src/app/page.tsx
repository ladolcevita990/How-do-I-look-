"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const hydrated = useAppStore((s) => s.hydrated);
  const photoId = useAppStore((s) => s.photoId);
  const savedOutfits = useAppStore((s) => s.savedOutfits);

  const returning = hydrated && (photoId || savedOutfits.length > 0);

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Top nav */}
      <nav className="px-4 md:px-8 py-5 flex items-center justify-between">
        <span className="text-lg font-bold text-neutral-900 tracking-tight">
          How Do I Look?
        </span>
        <div className="flex items-center gap-5 text-sm text-neutral-600">
          <button
            onClick={() => router.push("/lookbook")}
            className="hover:text-neutral-900"
          >
            Lookbook
          </button>
          <button
            onClick={() => router.push(photoId ? "/catalog" : "/upload")}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 font-medium"
          >
            {returning ? "Continue" : "Start"}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-16 md:py-24">
        <div className="max-w-3xl text-center space-y-8">
          <span className="inline-block text-xs uppercase tracking-[0.2em] text-neutral-500">
            Virtual try-on for any brand
          </span>
          <h1 className="text-5xl md:text-7xl font-serif font-semibold tracking-tight text-neutral-900 leading-[1.05]">
            See it on you
            <br />
            <span className="italic text-neutral-500">before</span> you buy it.
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 max-w-xl mx-auto leading-relaxed">
            Upload one full-body photo. Paste any product link — Santoni,
            Aurelien, Suitsupply, anything. Build a head-to-toe outfit and see
            how it looks on you in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => router.push(photoId ? "/catalog" : "/upload")}
              className="px-8 py-4 bg-neutral-900 text-white text-base font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
            >
              {returning ? "Continue your look" : "Upload your photo"}
            </button>
            <button
              onClick={() => router.push("/lookbook")}
              className="px-8 py-4 bg-white border border-neutral-300 text-neutral-900 text-base font-semibold rounded-xl hover:bg-neutral-100 transition-colors"
            >
              View lookbook
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-20 bg-white border-t border-neutral-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Three steps
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-neutral-900 mt-2">
              How it works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: "01",
                title: "Your photo",
                desc: "One full-body shot from your phone or webcam. Stays on your device.",
              },
              {
                step: "02",
                title: "Any brand",
                desc: "Paste a product URL. We fetch the image, remove the background, and sort it into your closet.",
              },
              {
                step: "03",
                title: "Your look",
                desc: "Mix tops, trousers, shoes and accessories into full outfits. Save, compare, share.",
              },
            ].map((item) => (
              <div key={item.step} className="space-y-3">
                <div className="text-sm font-mono text-neutral-400">
                  {item.step}
                </div>
                <h3 className="text-xl font-serif font-semibold text-neutral-900">
                  {item.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center text-xs text-neutral-500 border-t border-neutral-200 bg-neutral-50">
        No accounts. No passwords. Your closet persists on this device for a
        year.
      </footer>
    </main>
  );
}
