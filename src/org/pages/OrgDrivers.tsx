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

type PresenceTone = "online" | "busy" | "off";

function presenceOf(presence: MemberPresence | undefined): {
  label: string;
  tone: PresenceTone;
} {
  if (!presence || !presence.is_online) {
    return { label: "Offline", tone: "off" };
  }
  if (presence.current_ride_id) {
    return { label: "On a ride", tone: "busy" };
  }
  return { label: "Online", tone: "online" };
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
    <>
      <div className="orgx-pagehead">
        <div>
          <p className="orgx-eyebrow">{org.name} · People</p>
          <h1 className="orgx-title">Drivers</h1>
          <p className="orgx-sub">
            {drivers.length} member{drivers.length === 1 ? "" : "s"} · live
            presence from driver locations.
          </p>
        </div>
        <div className="orgx-pagehead__actions">
          {!loading && !error ? (
            <button
              type="button"
              className="btn btn--primary btn--compact"
              onClick={() => {
                setShowAdd((current) => !current);
                setConfirmAdd(null);
                setActionError("");
              }}
            >
              {showAdd ? "Close" : "Add driver"}
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p className="muted-copy" role="status" style={{ marginBottom: 12 }}>
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <p className="form-error-message" role="alert" style={{ marginBottom: 12 }}>
          {actionError}
        </p>
      ) : null}

      {showAdd ? (
        <section className="orgx-panel" style={{ marginBottom: 20 }}>
          <div className="orgx-panel__head">
            <h2 className="orgx-panel__title">Add existing driver</h2>
          </div>
          <div className="orgx-panel__body">
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
              <div className="orgx-tablewrap">
                <table className="orgx-table">
                  <thead>
                    <tr>
                      <th scope="col">Driver</th>
                      <th scope="col">Detail</th>
                      <th scope="col">
                        <span className="orgx-cell__actions" style={{ display: "block" }}>Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => {
                      const alreadyMember = memberIds.has(result.id);
                      return (
                        <tr key={result.id}>
                          <td>
                            <span className="orgx-cell__primary">{result.full_name}</span>
                            <p className="orgx-cell__secondary">
                              {result.username ? `@${result.username}` : ""}
                            </p>
                          </td>
                          <td>
                            <span className="orgx-cell__secondary">
                              {[result.vehicle_type, result.status]
                                .filter(Boolean)
                                .join(" · ")}
                              {result.has_other_membership && !alreadyMember
                                ? " · Member elsewhere"
                                : ""}
                              {alreadyMember ? " · Already a member" : ""}
                            </span>
                          </td>
                          <td className="orgx-cell__actions">
                            {!alreadyMember ? (
                              <button
                                type="button"
                                className="btn btn--ghost btn--compact"
                                disabled={actionBusy}
                                onClick={() => setConfirmAdd(result)}
                              >
                                Select
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {confirmAdd ? (
              <div className="orgx-confirm">
                <p>
                  Add <strong>{confirmAdd.full_name}</strong> to {org.name}?
                </p>
                <div className="orgx-confirm__actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--compact"
                    disabled={actionBusy}
                    onClick={() => void handleConfirmAdd()}
                  >
                    {actionBusy ? "Adding…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    disabled={actionBusy}
                    onClick={() => setConfirmAdd(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="orgx-panel" aria-live="polite">
        <div className="orgx-panel__head">
          <h2 className="orgx-panel__title">Group directory</h2>
          <span className="orgx-panel__meta">{drivers.length}</span>
        </div>
        <div className="orgx-panel__body">
          {loading ? (
            <div className="loading-block" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <p>Loading drivers…</p>
            </div>
          ) : error ? (
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
          ) : drivers.length === 0 ? (
            <div className="orgx-empty">
              <p className="orgx-empty__title">No drivers yet</p>
              <p className="orgx-empty__text">
                Add the first member with “Add driver” above.
              </p>
            </div>
          ) : (
            <div className="orgx-tablewrap">
              <table className="orgx-table">
                <thead>
                  <tr>
                    <th scope="col">Driver</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last seen</th>
                    <th scope="col">
                      <span className="orgx-cell__actions" style={{ display: "block" }}>Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => {
                    const row = presenceByDriver.get(driver.id);
                    const status = presenceOf(row);
                    const vehicle = [driver.vehicle_type, driver.vehicle_model]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <tr key={driver.id}>
                        <td>
                          <span className="orgx-cell__primary">{driver.full_name}</span>
                          <p className="orgx-cell__secondary">
                            {[driver.username ? `@${driver.username}` : "", driver.plate_number]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </td>
                        <td>
                          <span className="orgx-cell__secondary">{vehicle || "—"}</span>
                        </td>
                        <td>
                          <span className={`orgx-badge orgx-badge--${status.tone}`}>
                            {status.label}
                          </span>
                        </td>
                        <td>
                          <span className="orgx-cell__secondary">
                            {row?.updated_at
                              ? timeAgo(new Date(row.updated_at).getTime())
                              : "—"}
                          </span>
                        </td>
                        <td className="orgx-cell__actions">
                          {confirmRemove?.id === driver.id ? (
                            <span className="orgx-cell__secondary">Confirm below</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--ghost btn--compact"
                              disabled={actionBusy}
                              onClick={() => setConfirmRemove(driver)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {confirmRemove ? (
            <div className="orgx-confirm">
              <p>
                Remove <strong>{confirmRemove.full_name}</strong> from{" "}
                {org.name}? Their driver account stays unchanged.
              </p>
              <div className="orgx-confirm__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--compact"
                  disabled={actionBusy}
                  onClick={() => void handleConfirmRemove()}
                >
                  {actionBusy ? "Removing…" : "Confirm"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--compact"
                  disabled={actionBusy}
                  onClick={() => setConfirmRemove(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <p className="orgx-note">
            Only {org.name} members are listed here. Contact details and trip
            history are not shown in this view.
          </p>
        </div>
      </section>
    </>
  );
}
