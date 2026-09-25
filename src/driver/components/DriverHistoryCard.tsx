import { Link } from "react-router-dom";
import { formatCentavos } from "../../legacy/lib/fare";
import type { Ride } from "../../legacy/types/ride";
import type { DeliveryBooking } from "../../legacy/types/delivery";
import type { PakyawanBooking } from "../../legacy/types/scheduledBooking";

interface HistoryRide extends Ride {
  service: "ride";
}

interface HistoryDelivery extends DeliveryBooking {
  service: "delivery";
}

interface HistoryPakyawan extends PakyawanBooking {
  service: "pakyawan";
}

type HistoryItem = HistoryRide | HistoryDelivery | HistoryPakyawan;

const SERVICE_LABELS: Record<string, string> = {
  ride: "Ride Now",
  delivery: "Delivery",
  pakyawan: "Pakyawan",
};

const SERVICE_COLORS: Record<string, string> = {
  ride: "hub-driver__service-badge--ride",
  delivery: "hub-driver__service-badge--delivery",
  pakyawan: "hub-driver__service-badge--pakyawan",
};

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getPickup(item: HistoryItem): string {
  if (item.service === "ride") return item.pickup_address;
  if (item.service === "delivery") return item.pickup_address;
  return item.pickup_location;
}

function getDestination(item: HistoryItem): string {
  if (item.service === "ride") return item.destination_address;
  if (item.service === "delivery") return item.delivery_address;
  return item.destination;
}

function getFare(item: HistoryItem): string | null {
  if (item.service === "ride" && item.fare_cents != null && Number.isFinite(item.fare_cents)) {
    return `₱${formatCentavos(item.fare_cents)}`;
  }
  if (item.service === "delivery" && item.price_cents != null && Number.isFinite(item.price_cents)) {
    return `₱${formatCentavos(item.price_cents)}`;
  }
  if (item.service === "pakyawan" && item.price_cents != null && Number.isFinite(item.price_cents)) {
    return `₱${formatCentavos(item.price_cents)}`;
  }
  return null;
}

function getStatusClass(status: string): string {
  if (status === "completed" || status === "delivered") return "hub-driver__status--completed";
  if (status === "cancelled") return "hub-driver__status--cancelled";
  return "";
}

export function DriverHistoryCard({ item, onClick }: { item: HistoryItem; onClick?: () => void }) {
  const fare = getFare(item);
  const statusClass = getStatusClass(item.status);
  const createdAt = item.created_at;

  return (
    <Link
      to={`/driver/history/${item.service}/${item.id}`}
      className="hub-driver__history-card"
      onClick={(e) => { if (onClick) { e.preventDefault(); onClick(); } }}
    >
      <div className="hub-driver__history-top">
        <span className={`hub-driver__service-badge ${SERVICE_COLORS[item.service]}`}>
          {SERVICE_LABELS[item.service]}
        </span>
        <time className="hub-driver__history-date" dateTime={createdAt}>
          {formatHistoryDate(createdAt)}
        </time>
      </div>

      <div className="hub-driver__history-route">
        <span className="hub-driver__history-pickup">{getPickup(item)}</span>
        <span className="hub-driver__history-arrow" aria-hidden="true">→</span>
        <span className="hub-driver__history-destination">{getDestination(item)}</span>
      </div>

      <div className="hub-driver__history-bottom">
        <span className={`hub-driver__status ${statusClass}`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace(/_/g, " ")}
        </span>
        {fare ? <strong className="hub-driver__history-fare">{fare}</strong> : null}
      </div>
    </Link>
  );
}