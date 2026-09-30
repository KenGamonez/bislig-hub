import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import { OrgPageHead } from "../components/OrgPageHead";
import {
  cancelOrgDelivery,
  cancelOrgPakyawan,
  fetchMemberDrivers,
  fetchMemberPresence,
  fetchMemberRecentDeliveries,
  fetchMemberRecentPakyawan,
  fetchMemberRecentRides,
  fetchOrgMembers,
  quoteOrgPakyawan,
  type MemberDriver,
  type MemberOpsBooking,
  type MemberOpsRide,
  type MemberPresence,
  type OrgRecord,
} from "../orgData";
import { timeAgo } from "../../notifications/notifications";

const POLL_MS = 15000;

const PAKYAWAN_CANCELLABLE = [
  "pending",
  "quoted",
  "scheduled",
  "driver_on_way",
  "driver_arrived",
  "in_progress",
];

function isDeliveryCancellable(status: string): boolean {
  return status !== "delivered" && status !== "cancelled";
}

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
  const [managed, setManaged] = useState<
    | { kind: "pakyawan"; row: MemberOpsBooking }
    | { kind: "delivery"; row: MemberOpsBooking }
    | null
  >(null);
  const [pricePesos, setPricePesos] = useState("");
  const [reason, setReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

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

  const openManage = (
    kind: "pakyawan" | "delivery",
    row: MemberOpsBooking
  ) => {
    setManaged({ kind, row } as
      | { kind: "pakyawan"; row: MemberOpsBooking }
      | { kind: "delivery"; row: MemberOpsBooking });
    setPricePesos("");
    setReason("");
    setActionError("");
    setActionNotice("");
  };

  const closeManage = () => {
    if (actionBusy) return;
    setManaged(null);
    setPricePesos("");
    setReason("");
    setActionError("");
  };

  const handleQuote = async () => {
    if (!managed || managed.kind !== "pakyawan") return;
    const pesos = Number.parseFloat(pricePesos);
    if (!Number.isFinite(pesos) || pesos <= 0) {
      setActionError("Enter a valid quoted price in pesos.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    setActionNotice("");
    try {
      await quoteOrgPakyawan(managed.row.id, Math.round(pesos * 100));
      setActionNotice(
        `Quoted ₱${pesos.toFixed(2)} for this Pakyawan booking.`
      );
      setManaged(null);
      setPricePesos("");
      await load();
    } catch (quoteFailure) {
      console.error("Unable to quote booking:", quoteFailure);
      setActionError(
        quoteFailure instanceof Error
          ? quoteFailure.message
          : "Unable to quote this booking. Please try again."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!managed) return;
    if (!reason.trim()) {
      setActionError("A cancellation reason is required.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    setActionNotice("");
    try {
      const result =
        managed.kind === "pakyawan"
          ? await cancelOrgPakyawan(managed.row.id, reason.trim())
          : await cancelOrgDelivery(managed.row.id, reason.trim());
      setActionNotice(
        result.already_cancelled
          ? "This booking was already cancelled."
          : `Cancelled (was ${result.previous_status}).`
      );
      setManaged(null);
      setReason("");
      await load();
    } catch (cancelFailure) {
      console.error("Unable to cancel booking:", cancelFailure);
      setActionError(
        cancelFailure instanceof Error
          ? cancelFailure.message
          : "Unable to cancel this booking. Please try again."
      );
    } finally {
      setActionBusy(false);
    }
  };

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
      <OrgPageHead
        eyebrow="Activity"
        title="Operations activity"
        description={`Live presence and member service operations for ${org.name} — quotes, cancellations, and recent activity in one place.`}
      />

      <section className="orgx-panel" style={{ marginBottom: 20 }} aria-live="polite">
        <div className="orgx-panel__head">
          <h2 className="orgx-panel__title">Live snapshot</h2>
          <span className="orgx-panel__meta">Refreshes every 15 seconds</span>
        </div>
        <div className="orgx-panel__body">
          <div className="orgx-statrow">
            <span className="orgx-statrow__label">Online now</span>
            <span className="orgx-statrow__value">{onlineNow.length}</span>
          </div>
          <div className="orgx-statrow">
            <span className="orgx-statrow__label">On rides</span>
            <span className="orgx-statrow__value">{onRide.length}</span>
          </div>
          <div className="orgx-statrow">
            <span className="orgx-statrow__label">Members</span>
            <span className="orgx-statrow__value">{drivers.length}</span>
          </div>
          <div className="orgx-statrow">
            <span className="orgx-statrow__label">Offline</span>
            <span className="orgx-statrow__value">
              {drivers.length - onlineNow.length}
            </span>
          </div>
        </div>
      </section>

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
              {actionNotice ? (
                <p className="muted-copy" role="status">
                  {actionNotice}
                </p>
              ) : null}
              <OpsTable
                title="Ride Now"
                kind="ride"
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
                kind="pakyawan"
                rows={recentPakyawan}
                nameOf={nameOf}
                onManage={(row) => openManage("pakyawan", row)}
              />
              <OpsTable
                title="Deliveries"
                kind="delivery"
                rows={recentDeliveries}
                nameOf={nameOf}
                onManage={(row) => openManage("delivery", row)}
              />
              {managed ? (
                <ManageOpsPanel
                  kind={managed.kind}
                  row={managed.row}
                  nameOf={nameOf}
                  pricePesos={pricePesos}
                  setPricePesos={setPricePesos}
                  reason={reason}
                  setReason={setReason}
                  actionBusy={actionBusy}
                  actionError={actionError}
                  onQuote={() => void handleQuote()}
                  onCancel={() => void handleCancel()}
                  onClose={closeManage}
                />
              ) : null}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function isRowActionable(
  kind: "ride" | "pakyawan" | "delivery",
  status: string
): boolean {
  if (kind === "pakyawan") {
    return status === "pending" || PAKYAWAN_CANCELLABLE.includes(status);
  }
  if (kind === "delivery") {
    return isDeliveryCancellable(status);
  }
  return false;
}

function OpsTable({
  title,
  kind,
  rows,
  nameOf,
  onManage,
}: {
  title: string;
  kind: "ride" | "pakyawan" | "delivery";
  rows: Array<{ id: string; status: string; created_at: string; driver_id: string | null }>;
  nameOf: (driverId: string) => string;
  onManage?: (row: MemberOpsBooking) => void;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p className="orgx-panel__title" style={{ margin: "12px 0 0" }}>
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
                <th scope="col">
                  <span className="orgx-cell__actions" style={{ display: "block" }}>Action</span>
                </th>
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
                  <td className="orgx-cell__actions">
                    {onManage && isRowActionable(kind, row.status) ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--compact"
                        onClick={() =>
                          onManage(row as MemberOpsBooking)
                        }
                      >
                        Manage
                      </button>
                    ) : (
                      <span className="orgx-cell__secondary">—</span>
                    )}
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

function ManageOpsPanel({
  kind,
  row,
  nameOf,
  pricePesos,
  setPricePesos,
  reason,
  setReason,
  actionBusy,
  actionError,
  onQuote,
  onCancel,
  onClose,
}: {
  kind: "pakyawan" | "delivery";
  row: MemberOpsBooking;
  nameOf: (driverId: string) => string;
  pricePesos: string;
  setPricePesos: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  actionBusy: boolean;
  actionError: string;
  onQuote: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const canQuote = kind === "pakyawan" && row.status === "pending";
  const canCancel =
    kind === "pakyawan"
      ? PAKYAWAN_CANCELLABLE.includes(row.status)
      : isDeliveryCancellable(row.status);

  return (
    <div className="orgx-confirm" aria-live="polite">
      <p className="orgx-panel__title" style={{ marginBottom: 4 }}>
        Manage {kind === "pakyawan" ? "booking" : "delivery"}
      </p>
      <p className="orgx-cell__secondary" style={{ margin: "0 0 4px" }}>
        <strong className="orgx-cell__primary">
          {row.driver_id ? nameOf(row.driver_id) : "Unassigned"}
        </strong>{" "}
        · {row.status}
      </p>
      {canQuote ? (
        <label className="field-block">
          <span className="field-label">Quoted price (₱)</span>
          <input
            className="input-field"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={pricePesos}
            onChange={(event) => setPricePesos(event.target.value)}
            placeholder="e.g. 150"
            disabled={actionBusy}
          />
        </label>
      ) : null}
      {canCancel ? (
        <label className="field-block">
          <span className="field-label">Cancellation reason — required</span>
          <input
            className="input-field"
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. customer requested cancellation"
            maxLength={200}
            disabled={actionBusy}
          />
        </label>
      ) : (
        <p className="muted-copy">
          This {kind === "pakyawan" ? "booking" : "delivery"} can no longer be
          changed (status: {row.status}).
        </p>
      )}
      {actionError ? (
        <p className="form-error-message" role="alert">
          {actionError}
        </p>
      ) : null}
      {canCancel ? (
        <p className="muted-copy" role="note">
          <strong>Warning:</strong> cancelling notifies the workflow
          immediately and cannot be undone here. Double-check before
          confirming.
        </p>
      ) : null}
      <div className="orgx-confirm__actions">
        {canQuote ? (
          <button
            type="button"
            className="btn btn--primary btn--compact"
            disabled={actionBusy}
            onClick={onQuote}
          >
            {actionBusy ? "Working…" : "Quote"}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            className="btn btn--ghost btn--compact orgx-btn-danger"
            disabled={actionBusy}
            onClick={onCancel}
          >
            {actionBusy ? "Working…" : "Cancel booking"}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          disabled={actionBusy}
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <p className="orgx-note">
        Actions apply only to this organization&apos;s assigned{" "}
        {kind === "pakyawan" ? "booking" : "delivery"} and are recorded under
        your admin account.
      </p>
    </div>
  );
}
