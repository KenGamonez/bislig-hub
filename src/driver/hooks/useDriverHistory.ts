import { useEffect, useState } from "react";
import { fetchDriverRideHistory } from "../../legacy/lib/rides";
import { fetchDriverDeliveredDeliveries } from "../../legacy/lib/deliveries";
import type { Ride } from "../../legacy/types/ride";
import type { DeliveryBooking } from "../../legacy/types/delivery";
import type { PakyawanBooking } from "../../legacy/types/scheduledBooking";

export type HistoryRide = Ride & { service: "ride" };
export type HistoryDelivery = DeliveryBooking & { service: "delivery" };
export type HistoryPakyawan = PakyawanBooking & { service: "pakyawan" };
export type HistoryItem = HistoryRide | HistoryDelivery | HistoryPakyawan;

export function useDriverHistory(driverId: string | null) {
  const [rides, setRides] = useState<HistoryRide[]>([]);
  const [deliveries, setDeliveries] = useState<HistoryDelivery[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId) {
      setRides([]);
      setDeliveries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchDriverRideHistory(driverId).catch(() => []),
      fetchDriverDeliveredDeliveries(driverId).catch(() => []),
    ])
      .then(([rideItems, deliveryItems]) => {
        if (!cancelled) {
          setRides(rideItems.map((r) => ({ ...r, service: "ride" })));
          setDeliveries(deliveryItems.map((d) => ({ ...d, service: "delivery" })));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  return { rides, deliveries, loading };
}