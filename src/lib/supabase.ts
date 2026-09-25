// Supabase client — not connected yet.
// Phase 3 will audit bislig-ride's project (epsxgqoqfrwymktjvujs) before wiring.
// Keep this module inert until env vars are provisioned.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase =
  url && anonKey ? createClient(url, anonKey) : (null as unknown as ReturnType<typeof createClient>);

// Helper to guard future calls
export function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}
