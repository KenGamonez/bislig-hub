import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../legacy/lib/supabase";
import { resolveDriverCredentials } from "../../legacy/lib/driverAuth";
import { fetchMyOrgAdminRows, fetchOrganization } from "../orgData";

/**
 * Organization sign-in. Mirrors the AdminLogin pattern (email + password,
 * generic errors) but authorizes exclusively via organization_admins —
 * never via app_metadata roles. Non-admin accounts are signed straight
 * back out.
 */
export function OrgLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      setError("Enter your username or email and password to continue.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    let resolvedEmail = identifier.trim();

    // Resolve username to authentication email using the existing
    // platform credential-resolution mechanism (same as /driver/login).
    try {
      resolvedEmail = await resolveDriverCredentials(identifier.trim());
    } catch (resolveError) {
      // If resolution fails (e.g. unknown username), fall back to using
      // the identifier as-is; Supabase signInWithPassword will handle
      // invalid credentials consistently.
      resolvedEmail = identifier.trim();
    }

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
        });

      if (signInError || !data.user) {
        throw signInError ?? new Error("Sign in failed.");
      }

      const rows = await fetchMyOrgAdminRows(data.user.id);

      if (rows.length === 0) {
        await supabase.auth.signOut();
        setError("This account does not have organization admin access.");
        return;
      }

      const org = await fetchOrganization(rows[0].org_id);

      if (!org) {
        await supabase.auth.signOut();
        setError("This account does not have organization admin access.");
        return;
      }

      navigate(`/org/${org.slug}/dashboard`, { replace: true });
    } catch (signInError) {
      console.error("Unable to sign in organization admin:", signInError);
      setError("Unable to sign in. Check your username/email and password and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-canvas">
        <main className="page" id="main-content">
          <div className="container">
            <div className="auth-card">
              <Link
                to="/"
                className="secondary-action compact-button auth-back"
              >
                Back to Home
              </Link>
              <div className="auth-header">
                <img
                  src="/assets/bislig-hub-logo.png"
                  alt="Bislig Hub"
                  className="hub-auth-logo"
                />
                <p className="eyebrow auth-eyebrow">Organization Admin</p>
                <h2>Sign in to manage your organization.</h2>
              </div>
              <form className="auth-card" onSubmit={(event) => void handleLogin(event)}>
                <label className="field-block">
                  <span className="field-label">USERNAME OR EMAIL</span>
                  <input
                    className="input-field"
                    type="text"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="e.g. kolot or organization email"
                    autoComplete="username"
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">Password</span>
                  <input
                    className="input-field"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                {error ? (
                  <p className="form-error-message" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="btn btn--primary btn--block"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
