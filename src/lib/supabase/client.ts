"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

/**
 * Browser Supabase client. Uses the public anon key (safe to expose).
 * White-label buyers set NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY in their .env.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env"
    );
  }
  return createBrowserClient<Database>(url, anonKey);
}
