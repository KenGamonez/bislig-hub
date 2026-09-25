import type { GpsState } from "../hooks/useDriverGps";

/**
 * Compact GPS state. Independent from online/offline presence:
 * a driver stays operational without a fix.
 */
export function GpsStatus({
  state,
  note,
}: {
  state: GpsState;
  note: string;
}) {
  if (state === "idle") return null;
  return (
    <div className="hub-driver__gps" role="status">
      <span
        className={`hub-driver__gps-dot${state === "connected" ? " is-on" : ""}`}
        aria-hidden="true"
      />
      <div>
        <p className="hub-driver__gps-title">
          GPS{" "}
          {state === "connected"
            ? "connected"
            : state === "locating"
              ? "locating…"
              : "unavailable"}
        </p>
        {note ? <p className="hub-driver__gps-note">{note}</p> : null}
      </div>
    </div>
  );
}
