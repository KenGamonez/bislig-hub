import { MapView } from "../../legacy/components/MapView";
import type { LatLng } from "../hooks/useDriverGps";

/**
 * Compact live map for the active job. Reuses MapView as-is (same props
 * the legacy dashboard passes): driver marker from our own GPS fix,
 * pickup marker prefers the passenger's shared fix, then the stored
 * pickup coordinates. No ETA, distance, or invented data.
 */
export function DriverMap({
  ownFix,
  passengerFix,
  pickupLat,
  pickupLng,
}: {
  ownFix: LatLng | null;
  passengerFix: LatLng | null;
  pickupLat: number | null;
  pickupLng: number | null;
}) {
  return (
    <div className="hub-driver__mapwrap">
      <MapView
        className="hub-driver__map"
        height={220}
        driverLatitude={ownFix?.latitude ?? null}
        driverLongitude={ownFix?.longitude ?? null}
        pickupLatitude={passengerFix?.latitude ?? pickupLat}
        pickupLongitude={passengerFix?.longitude ?? pickupLng}
      />
    </div>
  );
}
