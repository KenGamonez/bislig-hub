import { useState } from "react";
import { Navigate } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { LoadingState } from "../components/LoadingState";
import { useDriverSession } from "../hooks/useDriverSession";
import { changeDriverPassword } from "../../legacy/lib/driverAuth";
import {
  PASSWORD_HELP_TEXT,
  validatePasswordStrength,
} from "../../legacy/lib/driverAccounts";
import { completeFirstPasswordChange } from "../../org/orgData";

/**
 * First-login gate for provisioned drivers. Rendered instead of any
 * workspace while drivers.must_change_password is true (both the new
 * driver shell and the legacy driver entry gate here). Uses the existing
 * changeDriverPassword flow, then clears the flag via RPC.
 */
export function MustChangePasswordPage() {
  const session = useDriverSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  if (session.status === "loading") {
    return (
      <DriverPage title="Welcome" kicker="Driver">
        <LoadingState label="Checking your account…" />
      </DriverPage>
    );
  }

  if (session.status !== "active") {
    return <Navigate to="/driver/login" replace />;
  }

  if (!session.driver.must_change_password) {
    return <Navigate to="/driver/home" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Enter the temporary password you were given.");
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.ok) {
      setError(strength.problems[0]);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("Choose a password different from the temporary one.");
      return;
    }

    setSaving(true);

    try {
      await changeDriverPassword(
        currentPassword,
        newPassword,
        session.driver.email
      );
      await completeFirstPasswordChange();
      await session.refresh();
    } catch (submitError) {
      console.error("Unable to complete first password change:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update your password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DriverPage title="Welcome" kicker="Driver">
      <div className="hub-driver__card">
        <p className="hub-driver__panel-label">FIRST SIGN IN</p>
        <h3 style={{ margin: "4px 0 8px" }}>
          Set your own password, {session.driver.full_name.split(" ")[0]}.
        </h3>
        <p className="muted-copy" style={{ marginTop: 0 }}>
          For your security, replace the temporary password before you start
          driving. You cannot continue until this is done.
        </p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="hub-driver__form-grid">
            <label className="hub-driver__field-block">
              <span className="hub-driver__field-label">Temporary password</span>
              <input
                className="hub-driver__input"
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={saving}
              />
            </label>
            <label className="hub-driver__field-block">
              <span className="hub-driver__field-label">New password</span>
              <input
                className="hub-driver__input"
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={saving}
              />
            </label>
            <label className="hub-driver__field-block">
              <span className="hub-driver__field-label">Confirm new password</span>
              <input
                className="hub-driver__input"
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={saving}
              />
            </label>
          </div>

          <p className="hub-driver__password-meta">{PASSWORD_HELP_TEXT}</p>

          <div className="hub-driver__form-actions">
            <button
              type="button"
              className="hub-driver__linkbtn"
              onClick={() => setShowPasswords((current) => !current)}
              disabled={saving}
            >
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>
          </div>

          {error ? (
            <p className="form-error-message" role="alert">
              {error}
            </p>
          ) : null}

          <div className="hub-driver__form-actions">
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={saving}
            >
              {saving ? "Saving…" : "Set password and continue"}
            </button>
          </div>
        </form>
      </div>
    </DriverPage>
  );
}
