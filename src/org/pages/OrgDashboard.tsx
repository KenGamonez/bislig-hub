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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className="muted-copy">{label}</span>
      <strong style={{ fontSize: 20 }}>{value}</strong>
    </div>
  );
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
  const presenceByDriver = new Map(
    presence.map((row) => [row.driver_id, row])
  );

  const online = presence.filter((row) => row.is_online);
  const available = presence.filter(
    (row) => row.is_online && row.is_available && !row.current_ride_id
  );
  const onRide = presence.filter((row) => row.current_ride_id);

  return (
    <div className="container">
      <section className="driver-card" aria-live="polite">
        <p className="section-label">Group overview</p>
        <h3>
          {drivers.length} driver{drivers.length === 1 ? "" : "s"}
        </h3>
        {loading ? (
          <div className="loading-block" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading group data…</p>
          </div>
        ) : error ? (
          <>
            <p className="form-error-message" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => void retry()}
            >
              Retry
            </button>
          </>
        ) : (
          <div style={{ marginTop: 4 }}>
            <StatTile label="Online now" value={String(online.length)} />
            <StatTile label="Available" value={String(available.length)} />
            <StatTile label="On a ride" value={String(onRide.length)} />
          </div>
        )}
        <p className="muted-copy" style={{ marginTop: 12 }}>
          Counts reflect {org.name} members only, based on live driver
          presence. Trip history and per-ride earnings are not part of this
          view.
        </p>
      </section>

      {onRide.length > 0 ? (
        <section className="driver-card">
          <p className="section-label">Currently on rides</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {onRide.map((row) => {
              const driver = drivers.find((item) => item.id === row.driver_id);
              return (
                <li key={row.driver_id} style={{ padding: "6px 0" }}>
                  <strong>{driver?.full_name ?? "Driver"}</strong>
                  <span className="muted-copy">
                    {" "}
                    · {presenceByDriver.get(row.driver_id) ? "on a ride" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
