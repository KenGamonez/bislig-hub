import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import {
  addOrganizationMember,
  fetchMemberDrivers,
  fetchMemberPresence,
  fetchOrgMembers,
  removeOrganizationMember,
  searchDriversForMembership,
  type DriverSearchResult,
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
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DriverSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [confirmAdd, setConfirmAdd] = useState<DriverSearchResult | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MemberDriver | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

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

  const memberIds = new Set(drivers.map((driver) => driver.id));

  const handleSearch = async () => {
    const term = query.trim();
    if (term.length < 2) {
      setSearchError("Type at least 2 characters of the username.");
      return;
    }

    setSearching(true);
    setSearchError("");
    setConfirmAdd(null);

    try {
      setResults(await searchDriversForMembership(term));
    } catch (searchFailure) {
      console.error("Unable to search drivers:", searchFailure);
      setSearchError("Search is unavailable right now. Please try again.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmAdd = async () => {
    if (!confirmAdd) return;
    setActionBusy(true);
    setActionError("");

    try {
      await addOrganizationMember(org.id, confirmAdd.id);
      setConfirmAdd(null);
      setShowAdd(false);
      setQuery("");
      setResults([]);
      setNotice(
        `${confirmAdd.full_name} was added to ${org.name}.`
      );
      await load();
    } catch (addFailure) {
      console.error("Unable to add member:", addFailure);
      const message =
        addFailure instanceof Error ? addFailure.message : "";
      setActionError(
        /duplicate|already exists|23505/i.test(message)
          ? "That driver is already a member."
          : "Unable to add this driver. Please try again."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setActionBusy(true);
    setActionError("");

    try {
      await removeOrganizationMember(org.id, confirmRemove.id);
      setConfirmRemove(null);
      setNotice(
        `${confirmRemove.full_name} was removed from ${org.name}. Their driver account is unchanged.`
      );
      await load();
    } catch (removeFailure) {
      console.error("Unable to remove member:", removeFailure);
      setActionError("Unable to remove this driver. Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="container">
      <section className="driver-card" aria-live="polite">
        <p className="section-label">Group directory</p>
        <h3>
          {drivers.length} driver{drivers.length === 1 ? "" : "s"}
        </h3>
        {notice ? (
          <p className="muted-copy" role="status">
            {notice}
          </p>
        ) : null}
        {actionError ? (
          <p className="form-error-message" role="alert">
            {actionError}
          </p>
        ) : null}
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
        ) : drivers.length === 0 && !showAdd ? (
          <p className="muted-copy">No drivers in this group yet.</p>
        ) : null}

        {!loading && !error ? (
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => {
              setShowAdd((current) => !current);
              setConfirmAdd(null);
              setActionError("");
            }}
            style={{ marginTop: 8 }}
          >
            {showAdd ? "Close" : "Add Driver"}
          </button>
        ) : null}

        {showAdd ? (
          <div style={{ marginTop: 12 }}>
            <p className="section-label">Add existing driver</p>
            <label className="field-block">
              <span className="field-label">Username starts with</span>
              <input
                className="input-field"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. juan"
                maxLength={32}
              />
            </label>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              disabled={searching}
              onClick={() => void handleSearch()}
            >
              {searching ? "Searching…" : "Search"}
            </button>
            {searchError ? (
              <p className="form-error-message" role="alert">
                {searchError}
              </p>
            ) : null}
            {results.length > 0 ? (
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {results.map((result) => {
                  const alreadyMember = memberIds.has(result.id);
                  return (
                    <li
                      key={result.id}
                      style={{
                        padding: "8px 0",
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
                        <strong>{result.full_name}</strong>
                        <span className="muted-copy">
                          {result.username ? `@${result.username}` : ""}
                        </span>
                      </div>
                      <p className="muted-copy" style={{ margin: "2px 0 0" }}>
                        {[result.vehicle_type, result.status]
                          .filter(Boolean)
                          .join(" · ")}
                        {result.has_other_membership && !alreadyMember
                          ? " · Member of another driver organization"
                          : ""}
                        {alreadyMember ? " · Already a member" : ""}
                      </p>
                      {!alreadyMember ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--compact"
                          disabled={actionBusy}
                          onClick={() => setConfirmAdd(result)}
                          style={{ marginTop: 4 }}
                        >
                          Select
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {confirmAdd ? (
              <div style={{ marginTop: 12 }}>
                <p>
                  Add <strong>{confirmAdd.full_name}</strong> to {org.name}?
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={actionBusy}
                    onClick={() => void handleConfirmAdd()}
                  >
                    {actionBusy ? "Adding…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={actionBusy}
                    onClick={() => setConfirmAdd(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {drivers.length > 0 ? (
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
                  {confirmRemove?.id === driver.id ? (
                    <div style={{ marginTop: 4 }}>
                      <p>
                        Remove <strong>{driver.full_name}</strong> from{" "}
                        {org.name}? Their driver account stays unchanged.
                      </p>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={actionBusy}
                          onClick={() => void handleConfirmRemove()}
                        >
                          {actionBusy ? "Removing…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={actionBusy}
                          onClick={() => setConfirmRemove(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost btn--compact"
                      disabled={actionBusy}
                      onClick={() => setConfirmRemove(driver)}
                      style={{ marginTop: 4 }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="muted-copy" style={{ marginTop: 12 }}>
          Only {org.name} members are listed here. Contact details and trip
          history are not shown in this view.
        </p>
      </section>
    </div>
  );
}
