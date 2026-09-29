import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import {
  fetchMemberDrivers,
  fetchMemberPresence,
  fetchOrgMembers,
  type MemberDriver,
  type MemberPresence,
  type OrgRecord,
} from "../orgData";
import { timeAgo } from "../../notifications/notifications";

function presenceLabel(presence: MemberPresence | undefined): string {
  if (!presence || !presence.is_online) {
    return "Offline";
  }
  if (presence.current_ride_id) {
    return "On a ride";
  }
  return "Online";
}

export function OrgDrivers() {
  const { slug } = useParams();

  return (
    <OrgGuard slug={slug}>
      {(org) => <DriversBody org={org} />}
    </OrgGuard>
  );
}

function DriversBody({ org }: { org: OrgRecord }) {
  const [drivers, setDrivers] = useState<MemberDriver[]>([]);
  const [presence, setPresence] = useState<MemberPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const members = await fetchOrgMembers(org.id);
      const ids = members.map((member) => member.driver_id);
      const [driverRows, presenceRows] = await Promise.all([
        fetchMemberDrivers(ids),
        fetchMemberPresence(ids),
      ]);
      setDrivers(driverRows);
      setPresence(presenceRows);
      setError("");
    } catch (loadError) {
      console.error("Unable to load organization drivers:", loadError);
      setError("Unable to load drivers right now. Please try again.");
    }
  }, [org.id]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const presenceByDriver = new Map(
    presence.map((row) => [row.driver_id, row])
  );

  return (
    <div className="container">
      <section className="driver-card" aria-live="polite">
        <p className="section-label">Group directory</p>
        <h3>
          {drivers.length} driver{drivers.length === 1 ? "" : "s"}
        </h3>
        {loading ? (
          <div className="loading-block" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading drivers…</p>
          </div>
        ) : error ? (
          <>
            <p className="form-error-message" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => void load()}
            >
              Retry
            </button>
          </>
        ) : drivers.length === 0 ? (
          <p className="muted-copy">No drivers in this group yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
            {drivers.map((driver) => {
              const row = presenceByDriver.get(driver.id);
              const status = presenceLabel(row);
              const vehicle = [driver.vehicle_type, driver.vehicle_model]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={driver.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "baseline",
                    }}
                  >
                    <strong>{driver.full_name}</strong>
                    <span className="muted-copy">{status}</span>
                  </div>
                  <p className="muted-copy" style={{ margin: "2px 0 0" }}>
                    {[driver.username ? `@${driver.username}` : "", vehicle, driver.plate_number]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {row?.updated_at ? (
                    <p className="muted-copy" style={{ margin: "2px 0 0" }}>
                      Last seen {timeAgo(new Date(row.updated_at).getTime())}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted-copy" style={{ marginTop: 12 }}>
          Only {org.name} members are listed here. Contact details and trip
          history are not shown in this view.
        </p>
      </section>
    </div>
  );
}
