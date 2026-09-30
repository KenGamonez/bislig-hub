import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../legacy/lib/supabase";
import { fetchOrganization } from "../orgData";
import type { OrgRecord } from "../orgData";

export function OrgSettings() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<OrgRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const loadOrganization = async () => {
    setLoading(true);
    setError("");

    try {
      const org = await fetchOrganization(slug!);

      if (!org) {
        setError("Organization not found.");
        setLoading(false);
        return;
      }

      setOrganization(org);
      setName(org.name ?? "");
      setDescription(org.description ?? "");
      setLogoUrl(org.logo_url ?? "");
    } catch (fetchError) {
      console.error("Unable to load organization:", fetchError);
      setError("Unable to load organization. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !description.trim()) {
      setError("Organization name and description are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("organizations")
        .update({ name: name.trim(), description: description.trim() })
        .eq("id", organization!.id)
        .select()
        .single();

      if (error) throw error;

      setOrganization(data as OrgRecord);
      setName(data.name ?? "");
      setDescription(data.description ?? "");
      setLogoUrl(data.logo_url ?? "");

      setError("");
    } catch (saveError) {
      console.error("Unable to save organization:", saveError);
      setError("Unable to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadOrganization();
  }, [slug]);

  if (loading) {
    return (
      <div className="loading-block" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Loading organization settings…</p>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="orgx-panel">
        <div className="orgx-panel__body">
          <div className="orgx-error">
            <p className="form-error-message" role="alert">{error}</p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void loadOrganization()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="orgx-panel">
        <div className="orgx-panel__body">
          <div className="orgx-empty">
            <p className="orgx-empty__title">Organization not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="orgx-pagehead">
        <div>
          <p className="orgx-eyebrow">{organization.name} · Organization</p>
          <h1 className="orgx-title">Settings</h1>
          <p className="orgx-sub">
            Public identity for {organization.name} as shown to members.
          </p>
        </div>
      </div>

      <div className="orgx-grid orgx-grid--single">
        <section className="orgx-panel">
          <div className="orgx-panel__head">
            <h2 className="orgx-panel__title">Profile</h2>
          </div>
          <div className="orgx-panel__body">
            {error ? (
              <p className="form-error-message" role="alert">{error}</p>
            ) : null}

            {saving ? (
              <div className="loading-block" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <p>Saving…</p>
              </div>
            ) : null}

            <form onSubmit={(event) => void handleSave(event)}>
              <label className="field-block">
                <span className="field-label">Organization name</span>
                <input
                  className="input-field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={128}
                />
              </label>

              <label className="field-block">
                <span className="field-label">Description</span>
                <textarea
                  className="input-field"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={512}
                  rows={4}
                />
              </label>

              <label className="field-block">
                <span className="field-label">Logo URL</span>
                <input
                  className="input-field"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://example.com/logo.png"
                  disabled
                />
                <span className="muted-copy">Read-only (media management not yet implemented)</span>
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button type="submit" className="btn btn--primary btn--compact" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--compact"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
