import { formatCentavos } from "../legacy/lib/fare";
import { formatDeliveryTiming } from "../legacy/lib/deliveries";
import { formatPakyawanTiming } from "../legacy/lib/scheduledBookings";
import type { PendingOffer } from "../legacy/types/dispatch";
import type {
  DeliveryBooking,
  DeliveryOfferWithBooking,
} from "../legacy/types/delivery";
import type { Ride } from "../legacy/types/ride";
import type {
  PakyawanBooking,
  PakyawanOfferWithBooking,
} from "../legacy/types/scheduledBooking";

/**
 * Unified incoming-job view model. Pure reshaping of existing engine
 * results — no business rules, no invented fields. Anything the backend
 * does not return is omitted, never fabricated.
 */
export type DriverJob =
  | {
      kind: "ride";
      key: string;
      offerId: string;
      rideId: string;
      pickup: string;
      destination: string;
      fare: string | null;
      meta: string;
      expiresAt: string;
    }
  | {
      kind: "pakyawan";
      key: string;
      offerId: string | null;
      bookingId: string;
      pickup: string;
      destination: string;
      price: string | null;
      meta: string;
      expiresAt: string | null;
    }
  | {
      kind: "delivery";
      key: string;
      offerId: string | null;
      deliveryId: string;
      pickup: string;
      destination: string;
      price: string | null;
      meta: string;
      expiresAt: string | null;
    };

export function peso(cents: number | null | undefined): string | null {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return `₱${formatCentavos(cents)}`;
}

export function rideToJob(pending: PendingOffer): DriverJob {
  const ride: Ride = pending.ride;
  return {
    kind: "ride",
    key: `ride-${pending.offer.id}`,
    offerId: pending.offer.id,
    rideId: ride.id,
    pickup: ride.pickup_address,
    destination: ride.destination_address,
    fare: peso(ride.fare_cents),
    meta: `${ride.passenger_count} passenger${ride.passenger_count === 1 ? "" : "s"} · ${ride.passenger_type}`,
    expiresAt: pending.offer.expires_at,
  };
}

export function pakyawanOfferToJob(offer: PakyawanOfferWithBooking): DriverJob {
  const booking: PakyawanBooking = offer.booking;
  return {
    kind: "pakyawan",
    key: `pakyawan-offer-${offer.id}`,
    offerId: offer.id,
    bookingId: booking.id,
    pickup: booking.pickup_location,
    destination: booking.destination,
    price: peso(booking.price_cents),
    meta: `${booking.passengers} passenger${booking.passengers === 1 ? "" : "s"} · ${booking.trip_type} · ${formatPakyawanTiming(booking.booking_date, booking.pickup_time)}`,
    expiresAt: offer.expires_at,
  };
}

export function pakyawanRequestToJob(booking: PakyawanBooking): DriverJob {
  return {
    kind: "pakyawan",
    key: `pakyawan-request-${booking.id}`,
    offerId: null,
    bookingId: booking.id,
    pickup: booking.pickup_location,
    destination: booking.destination,
    price: peso(booking.price_cents),
    meta: `${booking.passengers} passenger${booking.passengers === 1 ? "" : "s"} · ${booking.trip_type} · ${formatPakyawanTiming(booking.booking_date, booking.pickup_time)}`,
    expiresAt: null,
  };
}

export function deliveryOfferToJob(offer: DeliveryOfferWithBooking): DriverJob {
  const booking: DeliveryBooking = offer.booking;
  return {
    kind: "delivery",
    key: `delivery-offer-${offer.id}`,
    offerId: offer.id,
    deliveryId: booking.id,
    pickup: booking.pickup_address,
    destination: booking.delivery_address,
    price: peso(booking.price_cents),
    meta: `${booking.package_type} · ${booking.package_size} · ${formatDeliveryTiming(booking.preferred_date, booking.preferred_time)}`,
    expiresAt: offer.expires_at,
  };
}

export function deliveryRequestToJob(booking: DeliveryBooking): DriverJob {
  return {
    kind: "delivery",
    key: `delivery-request-${booking.id}`,
    offerId: null,
    deliveryId: booking.id,
    pickup: booking.pickup_address,
    destination: booking.delivery_address,
    price: peso(booking.price_cents),
    meta: `${booking.package_type} · ${booking.package_size} · ${formatDeliveryTiming(booking.preferred_date, booking.preferred_time)}`,
    expiresAt: null,
  };
}

export function isLiveOffer(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > now;
}
