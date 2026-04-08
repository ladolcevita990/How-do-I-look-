"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Single Supabase client for the whole browser session.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL       – e.g. https://xxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  – the anon public key from project settings
 *
 * We never use the service_role key on the client.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export const SUPABASE_BUCKET = "hdil";

// ---- Session id ----------------------------------------------------------
// The app has no accounts. Each browser gets a random uuid that lives in
// localStorage for a year. All rows and storage paths are keyed by it.

const SESSION_KEY = "hdil_session_id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function clearSessionId(): string {
  if (typeof window === "undefined") return "";
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

// ---- Storage URL helpers -------------------------------------------------

export function publicUrl(storagePath: string | null | undefined): string {
  if (!storagePath) return "";
  if (storagePath.startsWith("http") || storagePath.startsWith("data:")) {
    return storagePath;
  }
  const { data } = supabase().storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
