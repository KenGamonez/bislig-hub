import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { advanceDeliveryStatus, setDeliveryDriverPrice, completeDeliveryWithProof, type DeliveryLifecycleStatus } from "../../legacy/lib/deliveries";
import {
  buildDeliveryProofPath,
  uploadDeliveryProof,
  removeDeliveryProof,
  validateDeliveryProofImage,
} from "../../legacy/lib/deliveryProof";
import { formatCentavos } from "../../legacy/lib/fare";
import { formatDeliveryTiming } from "../../legacy/lib/deliveries";
import type { DeliveryBooking } from "../../legacy/types/delivery";
import { DeliveryChatSection } from "../../legacy/components/DeliveryChatSection";
import { DeliveryRating } from "../../legacy/components/DeliveryRating";
import { ActiveJobActions } from "./ActiveJobActions";
import { ActiveJobCustomer } from "./ActiveJobCustomer";
import { ActiveJobHeader } from "./ActiveJobHeader";
import { ActiveJobRoute } from "./ActiveJobRoute";
import { JourneySteps } from "./JourneySteps";
import { PriceProposalCard } from "./PriceProposalCard";

const TRIP_STEPS = ["On way", "Arrived", "Picked up", "In transit", "Delivered"];

const TRIP_INDEX: Record<string, number> = {
  confirmed: 0,
  driver_on_way: 0,
  driver_arrived: 1,
  picked_up: 2,
  in_transit: 3,
  delivered: 4,
};

const NEXT_ACTION: Record<
  string,
  { label: string; next: DeliveryLifecycleStatus }
> = {
  confirmed: { label: "On my way", next: "driver_on_way" },
  driver_on_way: { label: "Arrived", next: "driver_arrived" },
  driver_arrived: { label: "Package picked up", next: "picked_up" },
  picked_up: { label: "Start delivery", next: "in_transit" },
};

const STAGE_LABEL: Record<string, string> = {
  assigned: "Price needed",
  quoted: "Fee sent",
  confirmed: "Confirmed",
  driver_on_way: "On the way",
  driver_arrived: "Arrived",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function friendlyError(error: unknown): string {
  if (import.meta.env.DEV) console.error("[delivery-active]", error);
  return "Couldn't update this delivery. Check your connection and try again.";
}

/**
 * Hub-native delivery active view. Mirrors the legacy state machine
 * exactly (assigned → quoted → confirmed → trip chain → proof →
 * delivered); every mutation delegates to existing engine helpers.
 * No driver cancel RPC exists — none is offered.
 */
export function DeliveryActiveView({
  booking,
  onChanged,
}: {
  booking: DeliveryBooking;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const advance = async (next: DeliveryLifecycleStatus) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await advanceDeliveryStatus(booking.id, next);
      await onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const sendPrice = async (priceCents: number) => {
    await setDeliveryDriverPrice(booking.id, priceCents);
    await onChanged();
  };

  const selectProof = (file: File | undefined) => {
    if (!file) return;
    const validation = validateDeliveryProofImage(file);
    if (!validation.valid) {
      setError(validation.message ?? "Please take or choose a valid photo.");
      return;
    }
    setError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setProofFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const completeWithProof = async () => {
    if (uploading || !proofFile) return;
    setUploading(true);
    setError("");
    const path = buildDeliveryProofPath(booking.id, proofFile);
    try {
      await uploadDeliveryProof(path, proofFile);
      try {
        await completeDeliveryWithProof(booking.id, path);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setProofFile(null);
        await onChanged();
      } catch (rpcError) {
        await removeDeliveryProof(path);
        throw rpcError;
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setUploading(false);
    }
  };

  const action = NEXT_ACTION[booking.status] ?? null;

  return (
    <div className="hub-driver__card">
      <ActiveJobHeader status={booking.status} service="Delivery" />
      <p className="hub-driver__card-sub">
        {STAGE_LABEL[booking.status] ?? booking.status}
      </p>

      {TRIP_INDEX[booking.status] !== undefined ? (
        <JourneySteps steps={TRIP_STEPS} currentIndex={TRIP_INDEX[booking.status]} status={booking.status} />
      ) : null}

      <ActiveJobRoute
        pickup={booking.pickup_address}
        destination={booking.delivery_address}
      />

      <dl className="hub-driver__facts">
        <div>
          <dt>Package</dt>
          <dd>
            {booking.package_type} · {booking.package_size}
          </dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>
            {formatDeliveryTiming(booking.preferred_date, booking.preferred_time)}
          </dd>
        </div>
        <div>
          <dt>Fee</dt>
          <dd>
            {typeof booking.price_cents === "number"
              ? `₱${formatCentavos(booking.price_cents)}`
              : "Not set"}
          </dd>
        </div>
      </dl>

      {booking.package_details ? (
        <p className="hub-driver__card-sub">{booking.package_details}</p>
      ) : null}

      <ActiveJobCustomer
        name={booking.sender_name}
        phone={booking.sender_phone}
      />

      {booking.status === "assigned" ? (
        <PriceProposalCard
          label="Your delivery fee"
          onSubmit={(cents) => sendPrice(cents)}
        />
      ) : null}

      {booking.status === "quoted" ? (
        <p className="hub-driver__thanks" role="status">
          Fee sent — waiting for customer confirmation.
        </p>
      ) : null}

      {action ? (
        <ActiveJobActions
          primaryLabel={action.label}
          onPrimary={() => void advance(action.next)}
          busy={busy}
        >
          <button
            type="button"
            className="hub-driver__linkbtn"
            onClick={() => setShowChat((open) => !open)}
          >
            {showChat ? "Hide chat" : "Chat"}
          </button>
        </ActiveJobActions>
      ) : booking.status === "in_transit" ? (
        <div className="hub-driver__proof">
          <p className="hub-driver__card-title">Delivery proof</p>
          <label className="hub-driver__field">
            <span>Take or upload a photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={uploading}
              onChange={(e) => selectProof(e.target.files?.[0])}
            />
          </label>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Delivery proof preview"
              className="hub-driver__proof-preview"
            />
          ) : null}
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={uploading || !proofFile}
            onClick={() => void completeWithProof()}
          >
            {uploading ? "Completing…" : "Complete delivery"}
          </button>
          <button
            type="button"
            className="hub-driver__linkbtn"
            onClick={() => setShowChat((open) => !open)}
          >
            {showChat ? "Hide chat" : "Chat"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="hub-driver__linkbtn"
          onClick={() => setShowChat((open) => !open)}
        >
          {showChat ? "Hide chat" : "Chat"}
        </button>
      )}

      {error ? (
        <p className="form-error-message" role="alert">
          {error}
        </p>
      ) : null}

      {booking.status === "delivered" ? (
        <div className="hub-legacy">
          <DeliveryRating
            deliveryId={booking.id}
            raterRole="driver"
            ratedName={booking.sender_name}
          />
        </div>
      ) : null}

      {booking.status === "delivered" ? (
        <Link to="/driver/jobs" className="btn btn--primary btn--block">
          Back to jobs
        </Link>
      ) : null}

      {showChat ? (
        <div className="hub-legacy">
          <DeliveryChatSection
            deliveryId={booking.id}
            role="driver"
            otherPartyName={booking.sender_name}
            toggleLabel="Chat with customer"
            enableRealtime
            forceOpen={showChat}
            onOpenChange={(open) => setShowChat(open)}
          />
        </div>
      ) : null}
    </div>
  );
}
