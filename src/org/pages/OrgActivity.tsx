import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import {
  fetchMemberDrivers,
  fetchMemberPresence,
  fetchMemberRecentDeliveries,
  fetchMemberRecentPakyawan,
  fetchMemberRecentRides,
  fetchOrgMembers,
  type MemberDriver,
  type MemberOpsBooking,
  type MemberOpsRide,
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
  const [recentRides, setRecentRides] = useState<MemberOpsRide[]>([]);
  const [recentPakyawan, setRecentPakyawan] = useState<MemberOpsBooking[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<MemberOpsBooking[]>([]);
  const [opsError, setOpsError] = useState("");

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
      try {
        const [rides, pakyawan, deliveries] = await Promise.all([
          fetchMemberRecentRides(ids, 10),
          fetchMemberRecentPakyawan(ids, 10),
          fetchMemberRecentDeliveries(ids, 10),
        ]);
        setRecentRides(rides);
        setRecentPakyawan(pakyawan);
        setRecentDeliveries(deliveries);
        setOpsError("");
      } catch (opsFailure) {
        console.error("Unable to load member operations:", opsFailure);
        setOpsError(
          "Recent operations are unavailable right now. Live presence above is unaffected."
        );
      }
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

  if (loading) {
    return (
      <div className="loading-block" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Loading activity…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orgx-panel">
        <div className="orgx-panel__body">
          <div className="orgx-error">
            <p className="form-error-message" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="orgx-pagehead">
        <div>
          <p className="orgx-eyebrow">{org.name} · Operations</p>
          <h1 className="orgx-title">Activity</h1>
          <p className="orgx-sub">
            Live presence for {org.name} members, refreshed every 15 seconds.
          </p>
        </div>
      </div>

      <div className="orgx-kpis" role="group" aria-label="Live activity figures">
        <div className="orgx-kpi">
          <p className="orgx-kpi__label">Online now</p>
          <p className="orgx-kpi__value">{onlineNow.length}</p>
          <p className="orgx-kpi__sub">Showing presence</p>
        </div>
        <div className="orgx-kpi">
          <p className="orgx-kpi__label">On rides</p>
          <p className="orgx-kpi__value orgx-kpi__value--accent">
            {onRide.length}
          </p>
          <p className="orgx-kpi__sub">Currently engaged</p>
        </div>
        <div className="orgx-kpi">
          <p className="orgx-kpi__label">Members</p>
          <p className="orgx-kpi__value">{drivers.length}</p>
          <p className="orgx-kpi__sub">In group directory</p>
        </div>
        <div className="orgx-kpi">
          <p className="orgx-kpi__label">Offline</p>
          <p className="orgx-kpi__value">
            {drivers.length - onlineNow.length}
          </p>
          <p className="orgx-kpi__sub">Not showing presence</p>
        </div>
      </div>

      <div className="orgx-grid">
        <div className="orgx-col">
          <section className="orgx-panel" aria-live="polite">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">Online now</h2>
              <span className="orgx-panel__meta">{onlineNow.length}</span>
            </div>
            <div className="orgx-panel__body">
              {onlineNow.length === 0 ? (
                <div className="orgx-empty">
                  <p className="orgx-empty__title">Nobody online</p>
                  <p className="orgx-empty__text">
                    No group drivers are showing presence.
                  </p>
                </div>
              ) : (
                <div className="orgx-tablewrap">
                  <table className="orgx-table">
                    <thead>
                      <tr>
                        <th scope="col">Driver</th>
                        <th scope="col">Last seen</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onlineNow.map((row) => (
                        <tr key={row.driver_id}>
                          <td data-label="Driver">
                            <span className="orgx-cell__primary">
                              {nameOf(row.driver_id)}
                            </span>
                          </td>
                          <td data-label="Last seen">
                            <span className="orgx-cell__secondary">
                              {timeAgo(new Date(row.updated_at).getTime())}
                            </span>
                          </td>
                          <td data-label="Status">
                            <span
                              className={`orgx-badge ${
                                row.current_ride_id
                                  ? "orgx-badge--busy"
                                  : "orgx-badge--online"
                              }`}
                            >
                              {row.current_ride_id ? "On a ride" : "Online"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="orgx-col">
          <section className="orgx-panel" aria-live="polite">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">On active rides</h2>
              <span className="orgx-panel__meta">{onRide.length}</span>
            </div>
            <div className="orgx-panel__body">
              {onRide.length === 0 ? (
                <div className="orgx-empty">
                  <p className="orgx-empty__title">No active rides</p>
                  <p className="orgx-empty__text">
                    No group drivers are on a ride.
                  </p>
                </div>
              ) : (
                <div className="orgx-tablewrap">
                  <table className="orgx-table">
                    <thead>
                      <tr>
                        <th scope="col">Driver</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onRide.map((row) => (
                        <tr key={row.driver_id}>
                          <td data-label="Driver">
                            <span className="orgx-cell__primary">
                              {nameOf(row.driver_id)}
                            </span>
                          </td>
                          <td data-label="Status">
                            <span className="orgx-badge orgx-badge--busy">
                              On a ride
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="orgx-panel">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">About this view</h2>
            </div>
            <div className="orgx-panel__body">
              <p className="orgx-note" style={{ marginTop: 0 }}>
                Live presence plus recent member operations for {org.name}.
                Per-ride customer and payment details are never shown here.
              </p>
            </div>
          </section>
        </div>
      </div>

      <section className="orgx-panel" style={{ marginTop: 20 }}>
        <div className="orgx-panel__head">
          <h2 className="orgx-panel__title">Recent operations</h2>
          <span className="orgx-panel__meta">Members only</span>
        </div>
        <div className="orgx-panel__body">
          {opsError ? (
            <p className="muted-copy" role="alert">
              {opsError}
            </p>
          ) : (
            <div className="orgx-grid orgx-grid--single" style={{ gap: 0 }}>
              <OpsTable
                title="Ride Now"
                rows={recentRides.map((row) => ({
                  id: row.id,
                  status: row.status,
                  created_at: row.created_at,
                  driver_id: row.driver_id,
                }))}
                nameOf={nameOf}
              />
              <OpsTable
                title="Pakyawan"
                rows={recentPakyawan}
                nameOf={nameOf}
              />
              <OpsTable
                title="Deliveries"
                rows={recentDeliveries}
                nameOf={nameOf}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function OpsTable({
  title,
  rows,
  nameOf,
}: {
  title: string;
  rows: Array<{ id: string; status: string; created_at: string; driver_id: string | null }>;
  nameOf: (driverId: string) => string;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p className="section-label" style={{ margin: "12px 0 0" }}>
        {title} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="muted-copy">No recent {title.toLowerCase()} activity.</p>
      ) : (
        <div className="orgx-tablewrap">
          <table className="orgx-table">
            <thead>
              <tr>
                <th scope="col">Driver</th>
                <th scope="col">Status</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${title}-${row.id}`}>
                  <td data-label="Driver">
                    <span className="orgx-cell__primary">
                      {row.driver_id ? nameOf(row.driver_id) : "Unassigned"}
                    </span>
                  </td>
                  <td data-label="Status">
                    <span className="orgx-cell__secondary">{row.status}</span>
                  </td>
                  <td data-label="Date">
                    <span className="orgx-cell__secondary">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
