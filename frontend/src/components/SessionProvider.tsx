"use client";

import { useEffect, useState } from "react";
import { getSessionState } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { getOrCreateSessionId, isSupabaseConfigured } from "@/lib/supabase";

/**
 * On first load, generate (or read) the local session id, pull whatever
 * this browser has saved in Supabase — photo, closet, outfits — and hydrate
 * the Zustand store so returning visitors see their lookbook immediately.
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
      const sessionId = getOrCreateSessionId();
      if (!isSupabaseConfigured()) {
        // Let the rest of the app render even without Supabase; it just
        // won't persist anything. Useful for local dev / CI.
        if (cancelled) return;
        hydrate({
          session_id: sessionId,
          photo: null,
          garments: [],
          outfits: [],
        });
        return;
      }
      try {
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
        if (cancelled) return;
        hydrate({
          session_id: sessionId,
          photo: null,
          garments: [],
          outfits: [],
        });
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
