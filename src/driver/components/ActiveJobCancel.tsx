import { useState } from "react";
import { CancelRideModal } from "../../legacy/components/CancelRideModal";
import { cancelRide } from "../../legacy/lib/rides";

/**
 * Driver cancellation reusing the existing modal + cancel_ride RPC.
 * Same contract as the legacy dashboard: cancelRide(rideId, driverId,
 * 'driver', reason). Rendered inside .hub-legacy so the ported modal
 * keeps its own styles.
 */
export function ActiveJobCancel({
  rideId,
  driverId,
  onCancelled,
}: {
  rideId: string;
  driverId: string;
  onCancelled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async (reason: string) => {
    setSubmitting(true);
    setError("");
    try {
      await cancelRide(rideId, driverId, "driver", reason);
      setOpen(false);
      onCancelled();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[active-cancel]", err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't cancel this ride. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="hub-driver__linkbtn"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Cancel ride
      </button>
      {open ? (
        <div className="hub-legacy">
          <CancelRideModal
            open={open}
            role="driver"
            submitting={submitting}
            error={error}
            onClose={() => setOpen(false)}
            onConfirm={(reason) => void handleConfirm(reason)}
          />
        </div>
      ) : null}
    </>
  );
}
