import { StatusPill } from "./StatusPill";

const STAGE_LABEL: Record<string, string> = {
  accepted: "Heading to pickup",
  arrived: "At pickup",
  in_progress: "On trip",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ActiveJobHeader({ status }: { status: string }) {
  return (
    <div className="hub-driver__jobhead">
      <span className="hub-driver__jobtype">Ride Now</span>
      <StatusPill tone={status === "cancelled" ? "warn" : "active"}>
        {STAGE_LABEL[status] ?? status}
      </StatusPill>
    </div>
  );
}
