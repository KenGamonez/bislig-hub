// Bislig Hub — Ride Now data layer (Phase 4).
// Uses ONLY the audited customer-safe path:
//   1. INSERT INTO public.rides (status 'requested', driver_id null)
//   2. dispatch_ride(p_ride_id)  — never br_dispatch_ride_core
//   3. cancel_ride(...) for cancellation — never direct UPDATE
//   4. driver_profiles view for driver display — never drivers table

import { getCustomerAuthId, requireSupabase } from "./supabase";
import type { FareSource } from "./fare";

export type RideStatus =
  | "requested"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_driver";

export type VehicleType = "motorcycle" | "umbak" | "tricycle";

export type Ride = {
  id: string;
  customer_auth_id: string | null;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  driver_id: string | null;
  passenger_count: number;
  passenger_type: string;
  vehicle_type: VehicleType | null;
  fare_cents: number | null;
  fare_source: FareSource | null;
  status: RideStatus;
  created_at: string;
};

export type DispatchResult = {
  ride_id: string;
  ride_status: RideStatus | null;
  driver_assigned: string | null;
  offer_id: string | null;
  no_driver_found: boolean;
  no_driver_candidates: number;
};

export type DriverProfile = {
  id: string;
  full_name: string;
  profile_photo_url: string | null;
  vehicle_type: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_capacity: number | null;
  plate_number: string | null;
};

export type CreateRideInput = {
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  destination_address: string;
  passenger_count: number;
  passenger_type: string;
  vehicle_type: VehicleType;
  fare_cents: number | null;
  fare_source: FareSource | null;
};

/** Map raw Supabase/Postgres errors to concise human-readable messages. */
export function friendlyRideError(error: unknown, fallback: string): string {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error("[bislig-hub]", fallback, error);
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (/Failed to fetch|NetworkError|network/i.test(message)) {
      return "No connection. Check your internet and try again.";
    }
    if (/JWT|jwt|auth/i.test(message)) {
      return "Session expired. Please try again.";
    }
    if (/no longer available|expired/i.test(message)) {
      return "That ride is no longer available.";
    }
    if (/cannot be cancelled/i.test(message)) {
      return "This ride can no longer be cancelled.";
    }
  }
  return fallback;
}

export async function createRide(input: CreateRideInput): Promise<Ride> {
  const client = requireSupabase();
  // MUST equal auth.uid() — enforced by dispatch_ride's owner check.
  const customerAuthId = await getCustomerAuthId();

  const { data, error } = await client
    .from("rides")
    .insert({
      customer_auth_id: customerAuthId,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      pickup_address: input.pickup_address,
      pickup_lat: input.pickup_lat ?? null,
      pickup_lng: input.pickup_lng ?? null,
      destination_address: input.destination_address,
      destination_lat: null,
      destination_lng: null,
      driver_id: null,
      passenger_count: input.passenger_count,
      passenger_type: input.passenger_type,
      destination_mode: "same",
      destination_stops: [],
      vehicle_type: input.vehicle_type,
      fare_cents: input.fare_cents,
      fare_source: input.fare_source,
      status: "requested",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Ride;
}

export async function dispatchRide(rideId: string): Promise<DispatchResult> {
  const client = requireSupabase();
  // NOTE (live-verified 2026-09-25): do NOT use .single() here.
  // br_dispatch_ride_core is missing a RETURN after its pool=0 branch, so a
  // zero-candidate dispatch returns 3 rows (no_driver outcome + stale-status
  // echo + a NULL-driver phantom offer row) instead of 1. The FIRST row is
  // the authoritative outcome. Bislig Ride has the same latent behavior;
  // Hub only adapts its reader — no backend change.
  const { data, error } = await client.rpc("dispatch_ride", {
    p_ride_id: rideId,
  });

  if (error) throw error;
  const rows = data as DispatchResult[] | null;
  if (!rows || rows.length === 0) {
    throw new Error("Dispatch returned no result.");
  }
  return rows[0];
}

export async function fetchRideById(rideId: string): Promise<Ride | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("rides")
    .select("*")
    .eq("id", rideId)
    .maybeSingle();

  if (error) throw error;
  return (data as Ride | null) ?? null;
}

/** cancel_ride derives the actor from the session — pass-through ids only. */
export async function cancelRide(
  rideId: string,
  actorId: string,
  reason: string
): Promise<Ride> {
  const client = requireSupabase();
  const { data, error } = await client
    .rpc("cancel_ride", {
      p_ride_id: rideId,
      p_cancelled_by: actorId,
      p_cancelled_by_role: "customer",
      p_reason: reason,
    })
    .single();

  if (error) throw error;
  return data as Ride;
}

/** Safe driver display — driver_profiles view only (no PII columns exist there). */
export async function fetchDriverProfile(
  driverId: string
): Promise<DriverProfile | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("driver_profiles")
    .select("*")
    .eq("id", driverId)
    .maybeSingle();

  if (error) throw error;
  return (data as DriverProfile | null) ?? null;
}

/** Realtime ride-status observer with caller-managed polling fallback. */
export function subscribeToRideStatus(
  rideId: string,
  onUpdate: () => void
): () => void {
  const client = requireSupabase();
  const channel = client
    .channel(`hub-ride-status-${rideId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rides",
        filter: `id=eq.${rideId}`,
      },
      () => onUpdate()
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
