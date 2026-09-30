import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import { OrgConfirm } from "../OrgConfirm";
import {
  createOrgAnnouncement,
  deleteOrgAnnouncement,
  fetchOrgAnnouncements,
  updateOrgAnnouncement,
  type OrgAnnouncement,
  type OrgRecord,
} from "../orgData";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function excerpt(body: string, maxLength = 90): string {
  const text = body.trim().replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

const emptyDraft = { title: "", body: "", image_url: "" };

export function OrgAnnouncements() {
  const { slug } = useParams();

  return (
    <OrgGuard slug={slug}>
      {(org) => <AnnouncementsBody org={org} />}
    </OrgGuard>
  );
}

function AnnouncementsBody({ org }: { org: OrgRecord }) {
  const [items, setItems] = useState<OrgAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [pendingDelete, setPendingDelete] = useState<OrgAnnouncement | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      setItems(await fetchOrgAnnouncements(org.id));
      setError("");
    } catch (loadError) {
      console.error("Unable to load announcements:", loadError);
      setError("Unable to load announcements right now. Please try again.");
    }
  }, [org.id]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setShowForm(true);
    setFormError("");
  };

  const startEdit = (item: OrgAnnouncement) => {
    setEditingId(item.id);
    setShowForm(true);
    setDraft({
      title: item.title,
      body: item.body,
      image_url: item.image_url ?? "",
    });
    setFormError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setShowForm(false);
    setFormError("");
  };

  const handleSave = async (publish: boolean) => {
    if (!draft.title.trim() || !draft.body.trim()) {
      setFormError("Title and message are required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      if (editingId) {
        const current = items.find((item) => item.id === editingId);
        await updateOrgAnnouncement(editingId, {
          title: draft.title.trim(),
          body: draft.body.trim(),
          image_url: draft.image_url.trim() || null,
          // Publishing sets the timestamp; editing a published row keeps
          // its existing published_at unless explicitly unpublished.
          published_at: publish
            ? new Date().toISOString()
            : (current?.published_at ?? null),
        });
      } else {
        await createOrgAnnouncement({
          org_id: org.id,
          title: draft.title.trim(),
          body: draft.body.trim(),
          image_url: draft.image_url.trim() || null,
          published_at: publish ? new Date().toISOString() : null,
        });
      }
      cancelEdit();
      await load();
    } catch (saveError) {
      console.error("Unable to save announcement:", saveError);
      setFormError("Unable to save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async (item: OrgAnnouncement) => {
    setSaving(true);
    setFormError("");

    try {
      await updateOrgAnnouncement(item.id, { published_at: null });
      cancelEdit();
      await load();
    } catch (saveError) {
      console.error("Unable to unpublish announcement:", saveError);
      setFormError("Unable to unpublish. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: OrgAnnouncement) => {
    setSaving(true);
    setFormError("");

    try {
      await deleteOrgAnnouncement(item.id);
      if (editingId === item.id) cancelEdit();
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      console.error("Unable to delete announcement:", deleteError);
      setFormError("Unable to delete. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const published = items.filter((item) => item.published_at).length;

  return (
    <>
      <div className="orgx-pagehead">
        <div>
          <p className="orgx-eyebrow">{org.name} · Engagement</p>
          <h1 className="orgx-title">Announcements</h1>
          <p className="orgx-sub">
            {items.length} total · {published} published ·{" "}
            {items.length - published} drafts.
          </p>
        </div>
        <div className="orgx-pagehead__actions">
          {!loading && !error && !showForm ? (
            <button
              type="button"
              className="btn btn--primary btn--compact"
              onClick={startCreate}
            >
              New announcement
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="loading-block" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading announcements…</p>
        </div>
      ) : error ? (
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
      ) : (
        <>
          {showForm ? (
            <section className="orgx-panel" style={{ marginBottom: 20 }}>
              <div className="orgx-panel__head">
                <h2 className="orgx-panel__title">
                  {editingId ? "Edit announcement" : "New announcement"}
                </h2>
              </div>
              <div className="orgx-panel__body">
                <label className="field-block">
                  <span className="field-label">Title</span>
                  <input
                    className="input-field"
                    type="text"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    maxLength={120}
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">Message</span>
                  <textarea
                    className="input-field"
                    value={draft.body}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    rows={4}
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">Image URL (optional)</span>
                  <input
                    className="input-field"
                    type="url"
                    placeholder="https://…"
                    value={draft.image_url}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        image_url: event.target.value,
                      }))
                    }
                  />
                </label>
                {formError ? (
                  <p className="form-error-message" role="alert">
                    {formError}
                  </p>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--compact"
                    disabled={saving}
                    onClick={() => void handleSave(true)}
                  >
                    {saving ? "Saving…" : "Publish"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    disabled={saving}
                    onClick={() => void handleSave(false)}
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    disabled={saving}
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="orgx-panel" aria-live="polite">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">All announcements</h2>
              <span className="orgx-panel__meta">{items.length}</span>
            </div>
            <div className="orgx-panel__body">
              {formError && !showForm ? (
                <p className="form-error-message" role="alert">
                  {formError}
                </p>
              ) : null}
              {items.length === 0 ? (
                <div className="orgx-empty">
                  <p className="orgx-empty__title">No announcements yet</p>
                  <p className="orgx-empty__text">
                    Create the first one with “New announcement” above.
                  </p>
                </div>
              ) : (
                <div className="orgx-tablewrap">
                  <table className="orgx-table">
                    <thead>
                      <tr>
                        <th scope="col">Announcement</th>
                        <th scope="col">Visibility</th>
                        <th scope="col">Date</th>
                        <th scope="col">
                          <span className="orgx-cell__actions" style={{ display: "block" }}>Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td data-label="Announcement">
                            <span className="orgx-cell__primary">{item.title}</span>
                            <p className="orgx-cell__secondary">
                              {excerpt(item.body)}
                            </p>
                          </td>
                          <td data-label="Visibility">
                            <span
                              className={`orgx-badge ${
                                item.published_at
                                  ? "orgx-badge--pub"
                                  : "orgx-badge--draft"
                              }`}
                            >
                              {item.published_at ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td data-label="Date">
                            <span className="orgx-cell__secondary">
                              {item.published_at
                                ? `Published ${formatDate(item.published_at)}`
                                : `Created ${formatDate(item.created_at)}`}
                            </span>
                          </td>
                          <td className="orgx-cell__actions">
                            <button
                              type="button"
                              className="btn btn--ghost btn--compact"
                              disabled={saving}
                              onClick={() => startEdit(item)}
                            >
                              Edit
                            </button>{" "}
                            {item.published_at ? (
                              <button
                                type="button"
                                className="btn btn--ghost btn--compact"
                                disabled={saving}
                                onClick={() => void handleUnpublish(item)}
                              >
                                Unpublish
                              </button>
                            ) : null}{" "}
                            <button
                              type="button"
                              className="btn btn--ghost btn--compact"
                              disabled={saving}
                              onClick={() => setPendingDelete(item)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
          {pendingDelete ? (
            <OrgConfirm
              title="Delete announcement"
              body={`Delete "${pendingDelete.title}"? This cannot be undone.`}
              confirmLabel="Delete"
              busyLabel="Deleting…"
              busy={saving}
              onConfirm={() => void handleDelete(pendingDelete)}
              onCancel={() => {
                if (!saving) setPendingDelete(null);
              }}
            />
          ) : null}
        </>
      )}
    </>
  );
}
