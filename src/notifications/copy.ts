import type { NotificationService } from "./notifications";

export type LifecycleCopy = { title: string; message: string };

/**
 * Driver-voiced lifecycle copy shared by the new driver shell and the
 * legacy driver workspace. Copy only — statuses are the existing
 * backend states, never invented.
 */
export const DRIVER_RIDE_COPY: Record<string, LifecycleCopy> = {
  accepted: {
    title: "Ride accepted",
    message: "Proceed to the passenger pickup location.",
  },
  arrived: {
    title: "Passenger pickup",
    message: "Wait for the passenger to board, then start the ride.",
  },
  in_progress: {
    title: "Ride started",
    message: "Take the passenger to the destination.",
  },
  completed: {
    title: "Ride completed",
    message: "Collect the fare from the passenger.",
  },
  cancelled: {
    title: "Ride cancelled",
    message: "This ride was cancelled. Head back to Jobs for new work.",
  },
};

export const DRIVER_PAKYAWAN_COPY: Record<string, LifecycleCopy> = {
  assigned: {
    title: "Pakyawan assigned",
    message: "Head to the pickup location.",
  },
  quoted: {
    title: "Price sent",
    message: "Waiting for the customer to confirm your price.",
  },
  confirmed: {
    title: "Booking confirmed",
    message: "The customer confirmed your price.",
  },
  scheduled: {
    title: "Trip scheduled",
    message: "Head to the pickup location at the scheduled time.",
  },
  driver_on_way: {
    title: "Heading to pickup",
    message: "Navigate to the pickup location.",
  },
  driver_arrived: {
    title: "Arrived at pickup",
    message: "Wait for the passenger to board.",
  },
  in_progress: {
    title: "Trip started",
    message: "Take the passenger to the destination.",
  },
  completed: {
    title: "Trip completed",
    message: "You are available for new work.",
  },
  cancelled: {
    title: "Booking cancelled",
    message: "This Pakyawan booking was cancelled.",
  },
};

export const DRIVER_DELIVERY_COPY: Record<string, LifecycleCopy> = {
  assigned: {
    title: "Delivery assigned",
    message: "Head to the pickup location.",
  },
  quoted: {
    title: "Price sent",
    message: "Waiting for the sender to confirm.",
  },
  confirmed: {
    title: "Delivery confirmed",
    message: "The sender confirmed your price.",
  },
  driver_on_way: {
    title: "Heading to pickup",
    message: "Navigate to the pickup location.",
  },
  driver_arrived: {
    title: "Arrived at pickup",
    message: "Collect the package from the sender.",
  },
  picked_up: {
    title: "Package picked up",
    message: "Deliver it to the destination.",
  },
  in_transit: {
    title: "Delivery in transit",
    message: "Take the package to the destination.",
  },
  delivered: {
    title: "Delivery completed",
    message: "You are available for new work.",
  },
  cancelled: {
    title: "Delivery cancelled",
    message: "This delivery was cancelled.",
  },
  failed: {
    title: "Delivery failed",
    message: "This delivery could not be completed.",
  },
};

export const DRIVER_COPY_BY_SERVICE: Record<
  NotificationService,
  Record<string, LifecycleCopy>
> = {
  ride: DRIVER_RIDE_COPY,
  pakyawan: DRIVER_PAKYAWAN_COPY,
  delivery: DRIVER_DELIVERY_COPY,
};
