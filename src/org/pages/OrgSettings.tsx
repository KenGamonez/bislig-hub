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
    return <div className="container">Loading organization settings…</div>;
  }

  if (error) {
    return <div className="container"><p className="form-error-message" role="alert">{error}</p></div>;
  }

  if (!organization) {
    return <div className="container">Organization not found.</div>;
  }

  return (
    <div className="container">
      <h3>{organization.name} — Organization Settings</h3>

      {error ? (
        <p className="form-error-message" role="alert">{error}</p>
      ) : null}

      {saving ? (
        <p>Saving…</p>
      ) : null}

      <form onSubmit={(event) => void handleSave(event)}>
        <div>
          <label>Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={128}
            />
          </label>
        </div>

        <div>
          <label>Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={512}
            />
          </label>
        </div>

        <div>
          <label>Logo URL
            <input
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://example.com/logo.png"
              disabled
            />
            <span className="muted-copy">Read-only (media management not yet implemented)</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}