import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../legacy/lib/supabase";
import { resolveDriverCredentials } from "../../legacy/lib/driverAuth";
import { fetchMyOrgAdminRows, fetchOrganization } from "../orgData";
import "../org-premium.css";

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

    const identifierTrimmed = identifier.trim();
    // Determine if identifier is an email address or a username.
    const isEmail = identifierTrimmed.includes("@");
    let resolvedEmail = identifierTrimmed;

    // Resolve username to authentication email using the existing
    // platform credential-resolution mechanism (same as /driver/login).
    if (!isEmail) {
      try {
        resolvedEmail = await resolveDriverCredentials(identifierTrimmed);
      } catch (resolveError) {
        // Resolution failed for a username (e.g. unknown driver).
        // Do not fall back to using the username as email; Supabase
        // signInWithPassword requires a valid auth email.
        setError("Username not recognized. Please check your username or email and try again.");
        setIsSubmitting(false);
        return;
      }
    }
    // If identifier is an email, use it directly; no resolution needed.

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
    <div className="orgx orgx-auth">
      <aside className="orgx-auth__brand" aria-hidden="true">
        <img src="/assets/bislig-hub-logo.png" alt="" decoding="async" />
        <div>
          <p className="orgx-auth__org">Bislig Hub · Org Console</p>
          <p className="orgx-auth__headline">
            Run your transport group like an operation, not a chat thread.
          </p>
          <p className="orgx-auth__lede">
            Live driver presence, group directory, announcements, and
            coordination — in one calm, scannable console.
          </p>
        </div>
        <p className="orgx-auth__foot">
          Restricted to authorized organization administrators.
        </p>
      </aside>
      <main className="orgx-auth__formwrap" id="main-content">
        <div className="orgx-auth__form">
          <Link
            to="/"
            className="secondary-action compact-button auth-back orgx-auth__back"
          >
            Back to Home
          </Link>
          <p className="orgx-eyebrow">Organization Admin</p>
          <h1 className="orgx-auth__title">Sign in to your console.</h1>
          <p className="orgx-auth__sub">
            Use your Bislig Hub driver username or email.
          </p>
          <form onSubmit={(event) => void handleLogin(event)}>
            <label className="field-block">
              <span className="field-label">Username or email</span>
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
      </main>
    </div>
  );
}
