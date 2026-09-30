import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import {
  fetchMemberDrivers,
  fetchMemberPresence,
  fetchOrgAnnouncements,
  fetchOrgMembers,
  fetchOrgRideStats,
  type MemberDriver,
  type MemberPresence,
  type OrgRecord,
  type OrgRideStats,
} from "../orgData";

const POLL_MS = 15000;

function useOrgRoster(org: OrgRecord) {
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
      console.error("Unable to load organization roster:", loadError);
      setError("Unable to load group data right now. Please try again.");
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

  return { drivers, presence, loading, error, retry: load };
}

export function OrgDashboard() {
  const { slug } = useParams();

  return (
    <OrgGuard slug={slug}>
      {(org) => <DashboardBody org={org} />}
    </OrgGuard>
  );
}

function DashboardBody({ org }: { org: OrgRecord }) {
  const { drivers, presence, loading, error, retry } = useOrgRoster(org);
  const [rideStats, setRideStats] = useState<OrgRideStats | null>(null);
  const [rideStatsError, setRideStatsError] = useState("");
  const [publishedCount, setPublishedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRideStats(null);
    setRideStatsError("");
    void fetchOrgRideStats(org.id)
      .then((stats) => {
        if (!cancelled) setRideStats(stats);
      })
      .catch((statsError: unknown) => {
        console.error("Unable to load ride statistics:", statsError);
        if (!cancelled) {
          setRideStatsError(
            "Ride statistics are unavailable right now."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [org.id]);

  useEffect(() => {
    let cancelled = false;
    void fetchOrgAnnouncements(org.id)
      .then((items) => {
        if (cancelled) return;
        setPublishedCount(items.filter((item) => item.published_at).length);
        setDraftCount(items.filter((item) => !item.published_at).length);
      })
      .catch((announcementsError: unknown) => {
        console.error("Unable to load announcements snapshot:", announcementsError);
      });
    return () => {
      cancelled = true;
    };
  }, [org.id]);

  const online = presence.filter((row) => row.is_online);
  const available = presence.filter(
    (row) => row.is_online && row.is_available && !row.current_ride_id
  );
  const onRide = presence.filter((row) => row.current_ride_id);
  const nameOf = (driverId: string) =>
    drivers.find((item) => item.id === driverId)?.full_name ?? "Driver";

  if (loading) {
    return (
      <div className="loading-block" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Loading group data…</p>
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
              onClick={() => void retry()}
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
          <h1 className="orgx-title">Overview</h1>
          <p className="orgx-sub">
            Live group presence and aggregate ride performance for {org.name}{" "}
            members only.
          </p>
        </div>
        <div className="orgx-pagehead__actions">
          <Link
            to={`/org/${org.slug}/drivers`}
            className="btn btn--ghost btn--compact"
          >
            Manage drivers
          </Link>
        </div>
      </div>

      <div className="orgx-kpis" role="group" aria-label="Current group figures">
        <div className="orgx-kpi">
          <p className="orgx-kpi__label">Drivers</p>
          <p className="orgx-kpi__value">{drivers.length}</p>
          <p className="orgx-kpi__sub">Group members</p>
        </div>
        <div className="orgx-kpi">
          <p className="orgx-kpi__label">Online now</p>
          <p className="orgx-kpi__value">{online.length}</p>
          <p className="orgx-kpi__sub">Showing presence</p>
        </div>
        <div className="orgx-kpi">
          <p className="orgx-kpi__label">Available</p>
          <p className="orgx-kpi__value orgx-kpi__value--accent">
            {available.length}
          </p>
          <p className="orgx-kpi__sub">Ready for dispatch</p>
        </div>
        <div className="orgx-kpi">
          <p className="orgx-kpi__label">On a ride</p>
          <p className="orgx-kpi__value">{onRide.length}</p>
          <p className="orgx-kpi__sub">Currently engaged</p>
        </div>
      </div>

      <div className="orgx-grid">
        <div className="orgx-col">
          <section className="orgx-panel" aria-live="polite">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">Ride performance</h2>
            </div>
            <div className="orgx-panel__body">
              {rideStats ? (
                <div>
                  <div className="orgx-statrow">
                    <span className="orgx-statrow__label">Total rides</span>
                    <span className="orgx-statrow__value">
                      {rideStats.total_rides}
                    </span>
                  </div>
                  <div className="orgx-statrow">
                    <span className="orgx-statrow__label">Completed rides</span>
                    <span className="orgx-statrow__value">
                      {rideStats.completed_rides}
                    </span>
                  </div>
                  <div className="orgx-statrow">
                    <span className="orgx-statrow__label">Active rides</span>
                    <span className="orgx-statrow__value">
                      {rideStats.active_rides}
                    </span>
                  </div>
                  <div className="orgx-statrow">
                    <span className="orgx-statrow__label">Cancelled rides</span>
                    <span className="orgx-statrow__value">
                      {rideStats.cancelled_rides}
                    </span>
                  </div>
                </div>
              ) : rideStatsError ? (
                <p className="muted-copy" role="alert">
                  {rideStatsError}
                </p>
              ) : (
                <div className="loading-block" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <p>Loading ride statistics…</p>
                </div>
              )}
              <p className="orgx-note">
                Aggregate counts for {org.name} member drivers only. No trip,
                customer, or payment details are shown here.
              </p>
            </div>
          </section>

          <section className="orgx-panel">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">On active rides</h2>
              <span className="orgx-panel__meta">{onRide.length}</span>
            </div>
            <div className="orgx-panel__body">
              {onRide.length === 0 ? (
                <div className="orgx-empty">
                  <p className="orgx-empty__title">No drivers on rides</p>
                  <p className="orgx-empty__text">
                    Every member driver is currently off-trip.
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
        </div>

        <div className="orgx-col">
          <section className="orgx-panel">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">Announcements</h2>
              <Link
                to={`/org/${org.slug}/announcements`}
                className="orgx-linkbtn"
              >
                Manage
              </Link>
            </div>
            <div className="orgx-panel__body">
              <div className="orgx-statrow">
                <span className="orgx-statrow__label">Published</span>
                <span className="orgx-statrow__value">{publishedCount}</span>
              </div>
              <div className="orgx-statrow">
                <span className="orgx-statrow__label">Drafts</span>
                <span className="orgx-statrow__value">{draftCount}</span>
              </div>
              {draftCount > 0 ? (
                <p className="orgx-note">
                  {draftCount} draft{draftCount === 1 ? "" : "s"} waiting for
                  review.
                </p>
              ) : null}
            </div>
          </section>

          <section className="orgx-panel">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">Group</h2>
              <Link to={`/org/${org.slug}/drivers`} className="orgx-linkbtn">
                Directory
              </Link>
            </div>
            <div className="orgx-panel__body">
              <p style={{ margin: "0 0 4px", fontSize: 15, lineHeight: 1.6 }}>
                {drivers.length} member{drivers.length === 1 ? "" : "s"} ·{" "}
                {available.length} ready for dispatch
              </p>
              {org.description ? (
                <p className="orgx-note" style={{ marginTop: 8 }}>
                  {org.description}
                </p>
              ) : null}
              <p className="orgx-note">
                Counts reflect {org.name} members only, based on live driver
                presence.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
