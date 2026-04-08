"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getTryOnStatus, getOutfitStatus } from "@/lib/api";
import type { TryOnStatus, OutfitStatus } from "@/lib/types";

export function useTryOnPoll(jobId: string | null) {
  const [status, setStatus] = useState<TryOnStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      return;
    }

    const poll = async () => {
      try {
        const s = await getTryOnStatus(jobId);
        setStatus(s);
        if (s.status === "complete" || s.status === "failed") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Keep polling on transient errors
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  return status;
}

export function useOutfitPoll(jobId: string | null) {
  const [status, setStatus] = useState<OutfitStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    setStatus(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      return;
    }

    const poll = async () => {
      try {
        const s = await getOutfitStatus(jobId);
        setStatus(s);
        if (s.status === "complete" || s.status === "failed") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Keep polling on transient errors
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  return { status, reset };
}
