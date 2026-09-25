// Bislig Hub — Supabase client (Phase 4).
// Connects to the existing Bislig Ride Supabase project (epsxgqoqfrwymktjvujs)
// using ONLY customer-safe interfaces audited in Phase 3:
//   rides: direct INSERT + dispatch_ride + cancel_ride + save_ride_rating
//   pakyawan: create/get/confirm RPCs (token-gated)
//   read: own rides rows + driver_profiles view
// No admin/driver RPCs are called from Hub. No new tables/RPCs/policies.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// NOTE: Bislig Ride names this key VITE_SUPABASE_PUBLISHABLE_KEY (not ANON_KEY).
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(url && publishableKey);

if (!isSupabaseConfigured) {
  // Fail loudly in the console; pages render a friendly fallback instead.
  console.warn(
    "Bislig Hub: Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local."
  );
}

export const supabase = createClient(url ?? "", publishableKey ?? "");

export function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Transport is unavailable right now (missing connection). Please try again later."
    );
  }
  return supabase;
}

/**
 * Mirror of Bislig Ride's getCustomerAuthId().
 * - Reuses the existing authenticated session when present.
 * - Otherwise establishes a frictionless anonymous session.
 * - Returns auth.uid(), which MUST equal customer_auth_id on created rides.
 * Throws a human-safe error when anonymous auth is unavailable.
 */
export async function getCustomerAuthId(): Promise<string> {
  const client = requireSupabase();

  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (sessionData.session?.user.id) {
    return sessionData.session.user.id;
  }

  const { data, error } = await client.auth.signInAnonymously();

  if (error || !data.user) {
    throw error ?? new Error("Unable to start a guest session.");
  }

  return data.user.id;
}
