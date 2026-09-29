import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
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
    if (
      !window.confirm(`Delete "${item.title}"? This cannot be undone.`)
    ) {
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await deleteOrgAnnouncement(item.id);
      if (editingId === item.id) cancelEdit();
      await load();
    } catch (deleteError) {
      console.error("Unable to delete announcement:", deleteError);
      setFormError("Unable to delete. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container">
      <section className="driver-card" aria-live="polite">
        <p className="section-label">Group announcements</p>
        <h3>Announcements</h3>
        {loading ? (
          <div className="loading-block" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading announcements…</p>
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
        ) : (
          <>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={startCreate}
              style={{ marginTop: 8 }}
            >
              Create announcement
            </button>

            {showForm && (
              <div style={{ marginTop: 12 }}>
                <p className="section-label">
                  {editingId ? "Edit announcement" : "New announcement"}
                </p>
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
                    className="btn btn--primary"
                    disabled={saving}
                    onClick={() => void handleSave(true)}
                  >
                    {saving ? "Saving…" : "Publish"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={saving}
                    onClick={() => void handleSave(false)}
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={saving}
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {items.length === 0 ? (
              <p className="muted-copy" style={{ marginTop: 12 }}>
                No announcements yet. Create the first one above.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
                {items.map((item) => (
                  <li
                    key={item.id}
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
                      <strong>{item.title}</strong>
                      <span className="muted-copy">
                        {item.published_at ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="muted-copy" style={{ margin: "2px 0 0" }}>
                      {item.published_at
                        ? formatDate(item.published_at)
                        : `Created ${formatDate(item.created_at)}`}
                    </p>
                    <p style={{ margin: "6px 0" }}>{item.body}</p>
                    <div
                      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                    >
                      <button
                        type="button"
                        className="btn btn--ghost btn--compact"
                        disabled={saving}
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                      {item.published_at ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--compact"
                          disabled={saving}
                          onClick={() => void handleUnpublish(item)}
                        >
                          Unpublish
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn--ghost btn--compact"
                        disabled={saving}
                        onClick={() => void handleDelete(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
