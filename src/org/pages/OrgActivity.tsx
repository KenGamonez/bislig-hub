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

const POLL_MS = 15000;

export function OrgActivity() {
  const { slug } = useParams();

  return (
    <OrgGuard slug={slug}>
      {(org) => <ActivityBody org={org} />}
    </OrgGuard>
  );
}

function ActivityBody({ org }: { org: OrgRecord }) {
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
      console.error("Unable to load group activity:", loadError);
      setError("Unable to load activity right now. Please try again.");
    }
  }, [org.id]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const nameOf = (driverId: string) =>
    drivers.find((driver) => driver.id === driverId)?.full_name ?? "Driver";

  const onlineNow = presence.filter((row) => row.is_online);
  const onRide = presence.filter((row) => row.current_ride_id);

  return (
    <div className="container">
      {loading ? (
        <div className="loading-block" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading activity…</p>
        </div>
      ) : error ? (
        <section className="driver-card">
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
        </section>
      ) : (
        <>
          <section className="driver-card" aria-live="polite">
            <p className="section-label">
              Online now ({onlineNow.length})
            </p>
            {onlineNow.length === 0 ? (
              <p className="muted-copy">No group drivers are online.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {onlineNow.map((row) => (
                  <li key={row.driver_id} style={{ padding: "6px 0" }}>
                    <strong>{nameOf(row.driver_id)}</strong>
                    <span className="muted-copy">
                      {" "}
                      · seen {timeAgo(new Date(row.updated_at).getTime())}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="driver-card" aria-live="polite">
            <p className="section-label">
              On active rides ({onRide.length})
            </p>
            {onRide.length === 0 ? (
              <p className="muted-copy">No group drivers are on a ride.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {onRide.map((row) => (
                  <li key={row.driver_id} style={{ padding: "6px 0" }}>
                    <strong>{nameOf(row.driver_id)}</strong>
                    <span className="muted-copy"> · on a ride now</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="driver-card">
            <p className="section-label">Trip history</p>
            <p className="muted-copy">
              Per-ride history is not available in this view. Only live
              presence for {org.name} members is shown here.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
