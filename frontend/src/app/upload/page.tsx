"use client";

import { useRouter } from "next/navigation";
import PhotoCapture from "@/components/PhotoCapture";

export default function UploadPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Header */}
      <nav className="bg-white border-b border-neutral-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => router.push("/")}
          className="text-lg font-bold text-neutral-900"
        >
          How Do I Look?
        </button>
        <div className="hidden md:flex gap-2 text-sm text-neutral-500">
          <span className="bg-neutral-900 text-white px-3 py-1 rounded-full font-medium">
            1. Upload
          </span>
          <span className="px-3 py-1">2. Pick items</span>
          <span className="px-3 py-1">3. Try on</span>
        </div>
        <button
          onClick={() => router.push("/lookbook")}
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          Lookbook
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
        <PhotoCapture onComplete={() => router.push("/catalog")} />
      </div>
    </main>
  );
}
