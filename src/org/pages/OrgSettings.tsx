import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../legacy/lib/supabase";
import { OrgPageHead } from "../components/OrgPageHead";
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
  const [savedNotice, setSavedNotice] = useState(false);

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
      setSavedNotice(true);

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
      <OrgPageHead
        eyebrow={`${organization.name} · Organization`}
        title="Settings"
        description={`Public identity for ${organization.name} as shown to members.`}
      />

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

            <form
              className="orgx-form--constrained"
              onSubmit={(event) => void handleSave(event)}
            >
              <label className="field-block">
                <span className="field-label">Organization name</span>
                <input
                  className="input-field"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setSavedNotice(false);
                  }}
                  maxLength={128}
                />
              </label>

              <label className="field-block">
                <span className="field-label">Description</span>
                <textarea
                  className="input-field"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setSavedNotice(false);
                  }}
                  maxLength={512}
                  rows={4}
                />
              </label>

              <p className="orgx-fieldset-label">Organization logo</p>
              {logoUrl ? (
                <>
                  <div className="orgx-logo-preview">
                    <img
                      src={logoUrl}
                      alt={`${organization.name} logo`}
                      loading="lazy"
                    />
                  </div>
                  <p className="muted-copy">
                    Logo artwork is managed by the platform — contact Bislig
                    Hub to change it.
                  </p>
                </>
              ) : (
                <p className="muted-copy">
                  No logo set. Logo artwork is managed by the platform.
                </p>
              )}

              {savedNotice && !saving ? (
                <p className="muted-copy" role="status">
                  Changes saved.
                </p>
              ) : null}

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button type="submit" className="btn btn--primary btn--compact" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--compact"
                  onClick={() =>
                    navigate(`/org/${slug}/dashboard`, { replace: true })
                  }
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
