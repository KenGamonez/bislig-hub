import type { DriverJob } from "../jobs";

const LABELS: Record<DriverJob["kind"], string> = {
  ride: "Ride Now",
  pakyawan: "Pakyawan",
  delivery: "Delivery",
};

export function JobTypeBadge({ kind }: { kind: DriverJob["kind"] }) {
  return (
    <span className={`hub-driver__jobtype hub-driver__jobtype--${kind}`}>
      {LABELS[kind]}
    </span>
  );
}
