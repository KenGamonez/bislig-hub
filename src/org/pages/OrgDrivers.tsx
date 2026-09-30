import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import { OrgConfirm } from "../OrgConfirm";
import {
  addOrganizationMember,
  fetchMemberDriverDetail,
  fetchMemberDrivers,
  fetchMemberPresence,
  fetchMemberRecentRides,
  fetchOrgMembers,
  provisionOrgDriver,
  removeOrganizationMember,
  removeOrgDriverPhoto,
  searchDriversForMembership,
  updateOrgDriver,
  uploadOrgDriverPhoto,
  type DriverSearchResult,
  type MemberDriver,
  type MemberDriverDetail,
  type MemberPresence,
  type MemberOpsRide,
  type OrgRecord,
} from "../orgData";
import {
  createDriverAuthUser,
  isDriverUsernameTaken,
} from "../../legacy/lib/driverAuth";
import {
  generateTemporaryPassword,
  normalizeUsername,
  suggestUsername,
} from "../../legacy/lib/driverAccounts";
import { validateDriverPhoto } from "../../legacy/lib/driverProfilePhotos";
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

const emptyProvision = {
  full_name: "",
  email: "",
  username: "",
  phone: "",
  vehicle_type: "",
  vehicle_model: "",
  plate_number: "",
  tempPassword: "",
};

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

  // Driver detail / edit state (self-administration).
  const [managedId, setManagedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemberDriverDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [editDraft, setEditDraft] = useState({
    full_name: "",
    phone: "",
    vehicle_type: "",
    vehicle_model: "",
    vehicle_color: "",
    vehicle_capacity: "",
    plate_number: "",
    status: "active" as "active" | "inactive",
    can_accept_pakyawan: true,
    can_accept_deliveries: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [recentRides, setRecentRides] = useState<MemberOpsRide[]>([]);

  // Provisioning state (controlled account creation, password shown once).
  const [showProvision, setShowProvision] = useState(false);
  const [provision, setProvision] = useState(emptyProvision);
  const [provisionError, setProvisionError] = useState("");
  const [provisionBusy, setProvisionBusy] = useState(false);
  const [provisioned, setProvisioned] = useState<{
    full_name: string;
    username: string;
    email: string;
    tempPassword: string;
  } | null>(null);

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

  const openManage = async (driver: MemberDriver) => {
    setManagedId(driver.id);
    setDetail(null);
    setDetailError("");
    setEditError("");
    setPhotoError("");
    setRecentRides([]);
    setDetailLoading(true);
    try {
      const [row, rides] = await Promise.all([
        fetchMemberDriverDetail(driver.id),
        fetchMemberRecentRides([driver.id], 5).catch(() => []),
      ]);
      if (!row) {
        setDetailError("Driver record not found or not accessible.");
        return;
      }
      setDetail(row);
      setRecentRides(rides);
      setEditDraft({
        full_name: row.full_name ?? "",
        phone: row.phone ?? "",
        vehicle_type: row.vehicle_type ?? "",
        vehicle_model: row.vehicle_model ?? "",
        vehicle_color: row.vehicle_color ?? "",
        vehicle_capacity:
          row.vehicle_capacity === null || row.vehicle_capacity === undefined
            ? ""
            : String(row.vehicle_capacity),
        plate_number: row.plate_number ?? "",
        status: row.status === "inactive" ? "inactive" : "active",
        can_accept_pakyawan: row.can_accept_pakyawan !== false,
        can_accept_deliveries: row.can_accept_deliveries !== false,
      });
    } catch (detailFailure) {
      console.error("Unable to load driver detail:", detailFailure);
      setDetailError("Unable to load this driver right now. Please try again.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeManage = () => {
    if (editSaving || photoBusy) return;
    setManagedId(null);
    setDetail(null);
    setDetailError("");
    setEditError("");
    setPhotoError("");
  };

  const handleSaveEdit = async () => {
    if (!detail) return;
    if (!editDraft.full_name.trim()) {
      setEditError("Full name is required.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const capacity = editDraft.vehicle_capacity.trim();
      await updateOrgDriver(detail.id, {
        full_name: editDraft.full_name.trim(),
        phone: editDraft.phone.trim(),
        vehicle_type: editDraft.vehicle_type.trim(),
        vehicle_model: editDraft.vehicle_model.trim(),
        vehicle_color: editDraft.vehicle_color.trim(),
        vehicle_capacity:
          capacity === "" ? null : Number.parseInt(capacity, 10),
        plate_number: editDraft.plate_number.trim(),
        status: editDraft.status,
        can_accept_pakyawan: editDraft.can_accept_pakyawan,
        can_accept_deliveries: editDraft.can_accept_deliveries,
        profile_photo_url: detail.profile_photo_url ?? "",
      });
      setNotice(`${editDraft.full_name.trim()} was updated.`);
      await load();
      await openManage({
        id: detail.id,
        full_name: editDraft.full_name.trim(),
        username: detail.username,
        vehicle_type: editDraft.vehicle_type.trim() || null,
        vehicle_model: editDraft.vehicle_model.trim() || null,
        plate_number: editDraft.plate_number.trim() || null,
        status: editDraft.status,
      });
    } catch (saveFailure) {
      console.error("Unable to save driver:", saveFailure);
      setEditError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Unable to save changes. Please try again."
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handlePhotoFile = async (file: File | null) => {
    if (!detail || !file) return;
    const validation = validateDriverPhoto(file);
    if (!validation.valid) {
      setPhotoError(validation.message ?? "Please choose an image file.");
      return;
    }
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const uploaded = await uploadOrgDriverPhoto(detail.id, file);
      await updateOrgDriver(detail.id, {
        full_name: detail.full_name,
        phone: detail.phone ?? "",
        vehicle_type: detail.vehicle_type ?? "",
        vehicle_model: detail.vehicle_model ?? "",
        vehicle_color: detail.vehicle_color ?? "",
        vehicle_capacity: detail.vehicle_capacity,
        plate_number: detail.plate_number ?? "",
        status: detail.status === "inactive" ? "inactive" : "active",
        can_accept_pakyawan: detail.can_accept_pakyawan !== false,
        can_accept_deliveries: detail.can_accept_deliveries !== false,
        profile_photo_url: uploaded.publicUrl,
      });
      setNotice("Profile photo was updated.");
      await load();
      const row = await fetchMemberDriverDetail(detail.id);
      if (row) setDetail(row);
    } catch (photoFailure) {
      console.error("Unable to update photo:", photoFailure);
      setPhotoError("Unable to update the photo. Please try again.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!detail || !detail.profile_photo_url) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const prefix = "/driver-photos/";
      const url = detail.profile_photo_url;
      const path = url.includes(prefix)
        ? url.slice(url.indexOf(prefix) + prefix.length).split("?")[0]
        : "";
      if (path) {
        try {
          await removeOrgDriverPhoto(path);
        } catch (cleanupError) {
          console.error("Unable to remove photo bytes:", cleanupError);
        }
      }
      await updateOrgDriver(detail.id, {
        full_name: detail.full_name,
        phone: detail.phone ?? "",
        vehicle_type: detail.vehicle_type ?? "",
        vehicle_model: detail.vehicle_model ?? "",
        vehicle_color: detail.vehicle_color ?? "",
        vehicle_capacity: detail.vehicle_capacity,
        plate_number: detail.plate_number ?? "",
        status: detail.status === "inactive" ? "inactive" : "active",
        can_accept_pakyawan: detail.can_accept_pakyawan !== false,
        can_accept_deliveries: detail.can_accept_deliveries !== false,
        profile_photo_url: "",
      });
      setNotice("Profile photo was removed.");
      await load();
      const row = await fetchMemberDriverDetail(detail.id);
      if (row) setDetail(row);
    } catch (removeFailure) {
      console.error("Unable to remove photo:", removeFailure);
      setPhotoError("Unable to remove the photo. Please try again.");
    } finally {
      setPhotoBusy(false);
    }
  };

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
      setConfirmRemove(null);
      setActionError("Unable to remove this driver. Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSuggestUsername = () => {
    if (!provision.full_name.trim()) {
      setProvisionError("Enter the full name first to suggest a username.");
      return;
    }
    setProvision((current) => ({
      ...current,
      username: normalizeUsername(current.full_name),
    }));
    setProvisionError("");
  };

  const handleGeneratePassword = () => {
    setProvision((current) => ({
      ...current,
      tempPassword: generateTemporaryPassword(),
    }));
    setProvisionError("");
  };

  const handleProvision = async () => {
    const fullName = provision.full_name.trim();
    const email = provision.email.trim();
    const username = normalizeUsername(provision.username);
    const tempPassword = provision.tempPassword;

    if (!fullName || !email || !username || !tempPassword) {
      setProvisionError(
        "Full name, email, username, and a temporary password are required."
      );
      return;
    }
    if (!email.includes("@")) {
      setProvisionError("Enter a valid email address for the driver.");
      return;
    }

    setProvisionBusy(true);
    setProvisionError("");

    try {
      if (await isDriverUsernameTaken(username)) {
        setProvisionError("That username is already taken.");
        setProvisionBusy(false);
        return;
      }

      // Step 1: create the auth account with the existing public signup
      // helper (isolated client — the admin session is untouched).
      const account = await createDriverAuthUser(email, tempPassword);

      // Step 2: create the driver row + membership atomically (org-scoped
      // RPC). The account stays unconfirmed until the driver opens the
      // confirmation email; must_change_password gates first login.
      await provisionOrgDriver({
        org_id: org.id,
        full_name: fullName,
        email: account.email,
        username,
        auth_user_id: account.authUserId,
        phone: provision.phone.trim(),
        vehicle_type: provision.vehicle_type.trim(),
        vehicle_model: provision.vehicle_model.trim(),
        plate_number: provision.plate_number.trim(),
      });

      setProvisioned({
        full_name: fullName,
        username,
        email: account.email,
        tempPassword,
      });
      setProvision(emptyProvision);
      setShowProvision(false);
      await load();
    } catch (provisionFailure) {
      console.error("Unable to provision driver:", provisionFailure);
      setProvisionError(
        provisionFailure instanceof Error
          ? provisionFailure.message
          : "Unable to create this driver account. Please try again."
      );
    } finally {
      setProvisionBusy(false);
    }
  };

  const setProvisionField = (field: keyof typeof emptyProvision) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setProvision((current) => ({ ...current, [field]: event.target.value }));
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
            <>
              <button
                type="button"
                className="btn btn--primary btn--compact"
                onClick={() => {
                  setShowProvision(true);
                  setProvisioned(null);
                  setProvisionError("");
                }}
              >
                New driver
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={() => {
                  setShowAdd((current) => !current);
                  setConfirmAdd(null);
                  setActionError("");
                }}
              >
                {showAdd ? "Close" : "Add existing"}
              </button>
            </>
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

      {provisioned ? (
        <section className="orgx-panel" style={{ marginBottom: 20 }} aria-live="polite">
          <div className="orgx-panel__head">
            <h2 className="orgx-panel__title">Account created — share once</h2>
          </div>
          <div className="orgx-panel__body">
            <p style={{ marginTop: 0 }}>
              <strong>{provisioned.full_name}</strong> can now confirm their
              email ({provisioned.email}) and sign in. Share these credentials
              privately — they will not be shown again.
            </p>
            <div className="orgx-tablewrap">
              <table className="orgx-table">
                <tbody>
                  <tr>
                    <td data-label="Username">
                      <span className="orgx-cell__primary">
                        {provisioned.username}
                      </span>
                    </td>
                    <td data-label="Temporary password">
                      <span className="orgx-cell__primary">
                        {provisioned.tempPassword}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="orgx-note">
              The driver must change this password on first sign in.
            </p>
            <button
              type="button"
              className="btn btn--ghost btn--compact"
              onClick={() => setProvisioned(null)}
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {showProvision ? (
        <section className="orgx-panel" style={{ marginBottom: 20 }}>
          <div className="orgx-panel__head">
            <h2 className="orgx-panel__title">Provision new driver</h2>
          </div>
          <div className="orgx-panel__body">
            <label className="field-block">
              <span className="field-label">Full name</span>
              <input
                className="input-field"
                type="text"
                value={provision.full_name}
                onChange={setProvisionField("full_name")}
                placeholder="e.g. Juan Dela Cruz"
                maxLength={80}
              />
            </label>
            <label className="field-block">
              <span className="field-label">Email (login + confirmation)</span>
              <input
                className="input-field"
                type="email"
                value={provision.email}
                onChange={setProvisionField("email")}
                placeholder="driver@example.com"
                autoComplete="off"
              />
            </label>
            <label className="field-block">
              <span className="field-label">Username</span>
              <input
                className="input-field"
                type="text"
                value={provision.username}
                onChange={setProvisionField("username")}
                placeholder="e.g. juan.dela.cruz"
                maxLength={32}
                autoComplete="off"
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={handleSuggestUsername}
              >
                Suggest from name
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                onClick={handleGeneratePassword}
              >
                Generate temporary password
              </button>
            </div>
            <div className="orgx-tablewrap">
              <table className="orgx-table">
                <tbody>
                  <tr>
                    <td data-label="Suggested username">
                      <span className="orgx-cell__secondary">
                        {provision.username
                          ? `@${normalizeUsername(provision.username) || "—"}`
                          : suggestUsername(provision.full_name)
                            ? `@${suggestUsername(provision.full_name)}`
                            : "—"}
                      </span>
                    </td>
                    <td data-label="Temporary password">
                      <span className="orgx-cell__primary">
                        {provision.tempPassword || "—"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field-block">
                <span className="field-label">Phone</span>
                <input
                  className="input-field"
                  type="tel"
                  value={provision.phone}
                  onChange={setProvisionField("phone")}
                  placeholder="09…"
                  autoComplete="off"
                />
              </label>
              <label className="field-block">
                <span className="field-label">Plate number</span>
                <input
                  className="input-field"
                  type="text"
                  value={provision.plate_number}
                  onChange={setProvisionField("plate_number")}
                  maxLength={16}
                  autoComplete="off"
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field-block">
                <span className="field-label">Vehicle type</span>
                <input
                  className="input-field"
                  type="text"
                  value={provision.vehicle_type}
                  onChange={setProvisionField("vehicle_type")}
                  placeholder="e.g. tricycle"
                  maxLength={32}
                  autoComplete="off"
                />
              </label>
              <label className="field-block">
                <span className="field-label">Vehicle model</span>
                <input
                  className="input-field"
                  type="text"
                  value={provision.vehicle_model}
                  onChange={setProvisionField("vehicle_model")}
                  maxLength={64}
                  autoComplete="off"
                />
              </label>
            </div>
            {provisionError ? (
              <p className="form-error-message" role="alert">
                {provisionError}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn--primary btn--compact"
                disabled={provisionBusy}
                onClick={() => void handleProvision()}
              >
                {provisionBusy ? "Creating…" : "Create account"}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--compact"
                disabled={provisionBusy}
                onClick={() => {
                  setShowProvision(false);
                  setProvision(emptyProvision);
                  setProvisionError("");
                }}
              >
                Cancel
              </button>
            </div>
            <p className="orgx-note">
              Creates the login account, driver profile, and {org.name}{" "}
              membership in one controlled step. The temporary password is
              shown once above and never stored.
            </p>
          </div>
        </section>
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
                      <th scope="col">Details</th>
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
                          <td data-label="Driver">
                            <span className="orgx-cell__primary">{result.full_name}</span>
                            <p className="orgx-cell__secondary">
                              {result.username ? `@${result.username}` : ""}
                            </p>
                          </td>
                          <td data-label="Details">
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
                Provision the first member with “New driver” above.
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
                    const expanded = managedId === driver.id;
                    return (
                      <tr key={driver.id}>
                        <td data-label="Driver">
                          <span className="orgx-cell__primary">{driver.full_name}</span>
                          <p className="orgx-cell__secondary">
                            {[driver.username ? `@${driver.username}` : "", driver.plate_number]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </td>
                        <td data-label="Vehicle">
                          <span className="orgx-cell__secondary">{vehicle || "—"}</span>
                        </td>
                        <td data-label="Status">
                          <span className={`orgx-badge orgx-badge--${status.tone}`}>
                            {status.label}
                          </span>
                        </td>
                        <td data-label="Last seen">
                          <span className="orgx-cell__secondary">
                            {row?.updated_at
                              ? timeAgo(new Date(row.updated_at).getTime())
                              : "—"}
                          </span>
                        </td>
                        <td className="orgx-cell__actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--compact"
                            onClick={() =>
                              expanded ? closeManage() : void openManage(driver)
                            }
                          >
                            {expanded ? "Close" : "Manage"}
                          </button>{" "}
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

          {managedId ? (
            <DriverDetailPanel
              orgName={org.name}
              managedId={managedId}
              detail={detail}
              detailLoading={detailLoading}
              detailError={detailError}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              editSaving={editSaving}
              editError={editError}
              onSaveEdit={() => void handleSaveEdit()}
              photoBusy={photoBusy}
              photoError={photoError}
              onPhotoFile={(file) => void handlePhotoFile(file)}
              onRemovePhoto={() => void handleRemovePhoto()}
              recentRides={recentRides}
              onClose={closeManage}
            />
          ) : null}

          {confirmRemove ? (
            <OrgConfirm
              title="Remove driver"
              body={`Remove ${confirmRemove.full_name} from ${org.name}? Their driver account stays unchanged.`}
              confirmLabel="Remove"
              busyLabel="Removing…"
              busy={actionBusy}
              onConfirm={() => void handleConfirmRemove()}
              onCancel={() => {
                if (!actionBusy) setConfirmRemove(null);
              }}
            />
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

type EditDraft = {
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_capacity: string;
  plate_number: string;
  status: "active" | "inactive";
  can_accept_pakyawan: boolean;
  can_accept_deliveries: boolean;
};

function DriverDetailPanel({
  orgName,
  managedId,
  detail,
  detailLoading,
  detailError,
  editDraft,
  setEditDraft,
  editSaving,
  editError,
  onSaveEdit,
  photoBusy,
  photoError,
  onPhotoFile,
  onRemovePhoto,
  recentRides,
  onClose,
}: {
  orgName: string;
  managedId: string;
  detail: MemberDriverDetail | null;
  detailLoading: boolean;
  detailError: string;
  editDraft: EditDraft;
  setEditDraft: React.Dispatch<React.SetStateAction<EditDraft>>;
  editSaving: boolean;
  editError: string;
  onSaveEdit: () => void;
  photoBusy: boolean;
  photoError: string;
  onPhotoFile: (file: File | null) => void;
  onRemovePhoto: () => void;
  recentRides: MemberOpsRide[];
  onClose: () => void;
}) {
  const set = (field: keyof EditDraft) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setEditDraft((current) => ({ ...current, [field]: value }));
  };

  return (
    <section
      className="orgx-panel"
      style={{ marginTop: 16 }}
      aria-live="polite"
      aria-label="Driver details"
    >
      <div className="orgx-panel__head">
        <h2 className="orgx-panel__title">Driver details</h2>
        <button
          type="button"
          className="orgx-linkbtn"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="orgx-panel__body">
        {detailLoading ? (
          <div className="loading-block" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading driver…</p>
          </div>
        ) : detailError || !detail ? (
          <p className="form-error-message" role="alert">
            {detailError || "Driver record not found."}
          </p>
        ) : (
          <>
            <div
              style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
            >
              {detail.profile_photo_url ? (
                <img
                  src={detail.profile_photo_url}
                  alt={`${detail.full_name} profile photo`}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "var(--bg-surface-soft)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 20,
                    color: "var(--text-muted)",
                  }}
                >
                  {detail.full_name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <strong>{detail.full_name}</strong>
                <p className="orgx-cell__secondary" style={{ margin: "2px 0 0" }}>
                  {detail.username ? `@${detail.username}` : "No username"} ·{" "}
                  {detail.email ?? "No email"}
                </p>
                <p style={{ margin: "4px 0 0" }}>
                  <span
                    className={`orgx-badge ${
                      detail.status === "inactive"
                        ? "orgx-badge--off"
                        : "orgx-badge--online"
                    }`}
                  >
                    {detail.status === "inactive" ? "Inactive" : "Active"}
                  </span>{" "}
                  {detail.must_change_password ? (
                    <span className="orgx-badge orgx-badge--flag">
                      First login pending
                    </span>
                  ) : null}
                </p>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <label className="btn btn--ghost btn--compact" style={{ cursor: "pointer" }}>
                  {photoBusy ? "Uploading…" : detail.profile_photo_url ? "Replace photo" : "Add photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    disabled={photoBusy}
                    onChange={(event) => {
                      void onPhotoFile(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </label>
                {detail.profile_photo_url ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    disabled={photoBusy}
                    onClick={onRemovePhoto}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            {photoError ? (
              <p className="form-error-message" role="alert" style={{ marginTop: 8 }}>
                {photoError}
              </p>
            ) : null}

            <p className="section-label" style={{ marginTop: 16 }}>
              Profile &amp; vehicle
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field-block">
                <span className="field-label">Full name</span>
                <input
                  className="input-field"
                  type="text"
                  value={editDraft.full_name}
                  onChange={set("full_name")}
                  maxLength={80}
                />
              </label>
              <label className="field-block">
                <span className="field-label">Phone</span>
                <input
                  className="input-field"
                  type="tel"
                  value={editDraft.phone}
                  onChange={set("phone")}
                  maxLength={32}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field-block">
                <span className="field-label">Vehicle type</span>
                <input
                  className="input-field"
                  type="text"
                  value={editDraft.vehicle_type}
                  onChange={set("vehicle_type")}
                  maxLength={32}
                />
              </label>
              <label className="field-block">
                <span className="field-label">Vehicle model</span>
                <input
                  className="input-field"
                  type="text"
                  value={editDraft.vehicle_model}
                  onChange={set("vehicle_model")}
                  maxLength={64}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field-block">
                <span className="field-label">Color</span>
                <input
                  className="input-field"
                  type="text"
                  value={editDraft.vehicle_color}
                  onChange={set("vehicle_color")}
                  maxLength={32}
                />
              </label>
              <label className="field-block">
                <span className="field-label">Capacity</span>
                <input
                  className="input-field"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={editDraft.vehicle_capacity}
                  onChange={set("vehicle_capacity")}
                />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field-block">
                <span className="field-label">Plate number</span>
                <input
                  className="input-field"
                  type="text"
                  value={editDraft.plate_number}
                  onChange={set("plate_number")}
                  maxLength={16}
                />
              </label>
              <label className="field-block">
                <span className="field-label">Status</span>
                <select
                  className="input-field"
                  value={editDraft.status}
                  onChange={set("status")}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={editDraft.can_accept_pakyawan}
                  onChange={set("can_accept_pakyawan")}
                />
                Accepts Pakyawan
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={editDraft.can_accept_deliveries}
                  onChange={set("can_accept_deliveries")}
                />
                Accepts deliveries
              </label>
            </div>
            {editError ? (
              <p className="form-error-message" role="alert" style={{ marginTop: 8 }}>
                {editError}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--primary btn--compact"
                disabled={editSaving}
                onClick={onSaveEdit}
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>

            <p className="section-label" style={{ marginTop: 16 }}>
              Recent rides
            </p>
            {recentRides.length === 0 ? (
              <p className="muted-copy">No recent rides for this driver.</p>
            ) : (
              <div className="orgx-tablewrap">
                <table className="orgx-table">
                  <thead>
                    <tr>
                      <th scope="col">Status</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRides.map((ride) => (
                      <tr key={ride.id}>
                        <td data-label="Status">
                          <span className="orgx-cell__primary">{ride.status}</span>
                        </td>
                        <td data-label="Date">
                          <span className="orgx-cell__secondary">
                            {new Date(ride.created_at).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="orgx-note">
              Account identity (username, email, login) is platform-managed
              and cannot change here. Driver {managedId.slice(0, 8)}… · {orgName}.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
