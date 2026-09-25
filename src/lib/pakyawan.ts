// Bislig Hub — Pakyawan data layer (Phase 4).
// Uses ONLY the audited token-gated RPCs:
//   create_pakyawan_booking (11 args) → (id, access_token)
//   get_pakyawan_booking(id, token)  → tracking (10s polling, no realtime)
//   confirm_pakyawan_booking(id, token) → quoted → scheduled
// Never queries pakyawan_bookings directly. No chat in Phase 4.

import { requireSupabase } from "./supabase";

export const PAKYAWAN_TRIP_TYPES = [
  "One Way",
  "Round Trip",
  "Whole Day / Private Hire",
] as const;

export type PakyawanTripType = (typeof PAKYAWAN_TRIP_TYPES)[number];

export type PakyawanStatus =
  | "pending"
  | "quoted"
  | "confirmed"
  | "assigned"
  | "scheduled"
  | "driver_on_way"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PakyawanBooking = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  booking_date: string | null;
  pickup_time: string | null;
  pickup_location: string;
  destination: string;
  passengers: number;
  trip_type: PakyawanTripType;
  estimated_hours: number | null;
  special_requests: string | null;
  status: PakyawanStatus;
  driver_id: string | null;
  price_cents: number | null;
  created_at: string;
  updated_at: string;
};

export type CreatePakyawanInput = {
  customer_name: string;
  customer_phone: string;
  booking_date: string | null;
  pickup_time: string | null;
  pickup_location: string;
  destination: string;
  passengers: number;
  trip_type: PakyawanTripType;
  estimated_hours: number | null;
  special_requests: string | null;
};

export type PakyawanIdentity = {
  id: string;
  accessToken: string;
};

export function friendlyPakyawanError(
  error: unknown,
  fallback: string
): string {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error("[bislig-hub]", fallback, error);
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (/Failed to fetch|NetworkError|network/i.test(message)) {
      return "No connection. Check your internet and try again.";
    }
    if (/not found|reference/i.test(message)) {
      return "Booking not found. It may have expired from this device.";
    }
    if (/only quoted/i.test(message)) {
      return "Only quoted bookings can be confirmed.";
    }
  }
  return fallback;
}

export async function createPakyawanBooking(
  input: CreatePakyawanInput
): Promise<PakyawanIdentity> {
  const client = requireSupabase();
  const { data, error } = await client
    .rpc("create_pakyawan_booking", {
      // Anonymous Hub customers: no account, so customer_id stays null.
      p_customer_id: null,
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone,
      p_booking_date: input.booking_date,
      p_pickup_time: input.pickup_time,
      p_pickup_location: input.pickup_location,
      p_destination: input.destination,
      p_passengers: input.passengers,
      p_trip_type: input.trip_type,
      p_estimated_hours: input.estimated_hours,
      p_special_requests: input.special_requests,
    })
    .single<{ id: string; access_token: string }>();

  if (error) throw error;
  return { id: data.id, accessToken: data.access_token };
}

export async function getPakyawanBooking(
  bookingId: string,
  accessToken: string
): Promise<PakyawanBooking> {
  const client = requireSupabase();
  const { data, error } = await client
    .rpc("get_pakyawan_booking", {
      p_booking_id: bookingId,
      p_access_token: accessToken,
    })
    .single();

  if (error) throw error;
  const row = data as PakyawanBooking & { access_token?: string };
  delete row.access_token;
  return row;
}

export async function confirmPakyawanBooking(
  bookingId: string,
  accessToken: string
): Promise<PakyawanBooking> {
  const client = requireSupabase();
  const { data, error } = await client
    .rpc("confirm_pakyawan_booking", {
      p_booking_id: bookingId,
      p_access_token: accessToken,
    })
    .single();

  if (error) throw error;
  const row = data as PakyawanBooking & { access_token?: string };
  delete row.access_token;
  return row;
}
