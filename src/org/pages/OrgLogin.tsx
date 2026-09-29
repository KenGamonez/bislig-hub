import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../legacy/lib/supabase";
import { fetchMyOrgAdminRows, fetchOrganization } from "../orgData";

/**
 * Organization sign-in. Mirrors the AdminLogin pattern (email + password,
 * generic errors) but authorizes exclusively via organization_admins —
 * never via app_metadata roles. Non-admin accounts are signed straight
 * back out.
 */
export function OrgLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Enter your organization email and password to continue.");
      return;
    }

    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError || !data.user) {
        throw signInError ?? new Error("Sign in failed.");
      }

      const rows = await fetchMyOrgAdminRows(data.user.id);

      if (rows.length === 0) {
        await supabase.auth.signOut();
        setError("This account does not have organization access.");
        return;
      }

      const org = await fetchOrganization(rows[0].org_id);

      if (!org) {
        await supabase.auth.signOut();
        setError("This account does not have organization access.");
        return;
      }

      navigate(`/org/${org.slug}/dashboard`, { replace: true });
    } catch (signInError) {
      console.error("Unable to sign in organization admin:", signInError);
      setError("Unable to sign in. Check your email and password and try again.");
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
                <p className="eyebrow auth-eyebrow">Organization Access</p>
                <h2>TODA admin sign in</h2>
              </div>
              <form className="auth-card" onSubmit={(event) => void handleLogin(event)}>
                <label className="field-block">
                  <span className="field-label">Email</span>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="organization email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
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
