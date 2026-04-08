"use client";

import { useEffect, useState } from "react";
import { ensureSession, getSessionState } from "@/lib/api";
import { useAppStore } from "@/lib/store";

/**
 * Ensures the backend session cookie is set on first visit and rehydrates
 * the store with whatever this browser has saved — photo, closet, outfits —
 * so returning users see their lookbook immediately.
 */
export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const [welcomeBack, setWelcomeBack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const state = await getSessionState();
        if (cancelled) return;
        hydrate(state);
        const hasContent =
          !!state.photo ||
          state.garments.length > 0 ||
          state.outfits.length > 0;
        if (hasContent) {
          setWelcomeBack(true);
          setTimeout(() => setWelcomeBack(false), 3500);
        }
      } catch {
        // Silent fail — the rest of the app still works with a transient id.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  return (
    <>
      {children}
      {hydrated && welcomeBack && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg z-50 animate-fadein">
          Welcome back — your lookbook is loaded.
        </div>
      )}
    </>
  );
}
