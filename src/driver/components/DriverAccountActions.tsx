import { useState } from "react";
import { changeDriverPassword } from "../../legacy/lib/driverAuth";
import { PASSWORD_HELP_TEXT, validatePasswordStrength } from "../../legacy/lib/driverAccounts";
import { useDriverSession } from "../hooks/useDriverSession";

interface DriverAccountActionsProps {
  onCloseChangePassword: () => void;
}

export function DriverAccountActions({ onCloseChangePassword }: DriverAccountActionsProps) {
  const session = useDriverSession();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  const handleChangePasswordSubmit = async () => {
    setPasswordSuccess("");
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }

    const strength = validatePasswordStrength(newPassword);

    if (!strength.ok) {
      setPasswordError(strength.problems[0]);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);

    try {
      await changeDriverPassword(currentPassword, newPassword, session.driver?.email ?? null);
      setPasswordSuccess("Your password has been updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordFields(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update your password. Please try again.";
      setPasswordError(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCloseChangePassword = () => {
    setShowChangePassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setShowPasswordFields(false);
    onCloseChangePassword();
  };

  const handleLogout = async () => {
    await session.signOut();
  };

  return (
    <>
      <div className="hub-driver__actions-row">
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => setShowChangePassword(true)}
        >
          Change Password
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>

      {showChangePassword ? (
        <div className="hub-driver__card hub-driver__account-panel">
          <div className="hub-driver__panel-head">
            <div>
              <p className="hub-driver__panel-label">ACCOUNT SECURITY</p>
              <h3>Change password</h3>
              <p>Update the password you use to sign in.</p>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleCloseChangePassword}
              disabled={changingPassword}
            >
              Close
            </button>
          </div>

          {passwordSuccess ? (
            <p className="hub-driver__success" role="status">
              {passwordSuccess}
            </p>
          ) : null}

          <form onSubmit={(event) => { event.preventDefault(); void handleChangePasswordSubmit() }}>
            <div className="hub-driver__form-grid">
              <label className="hub-driver__field-block">
                <span className="hub-driver__field-label">Current password</span>
                <input
                  className="hub-driver__input"
                  type={showPasswordFields ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={changingPassword}
                />
              </label>
              <label className="hub-driver__field-block">
                <span className="hub-driver__field-label">New password</span>
                <input
                  className="hub-driver__input"
                  type={showPasswordFields ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={changingPassword}
                />
              </label>
              <label className="hub-driver__field-block">
                <span className="hub-driver__field-label">Confirm new password</span>
                <input
                  className="hub-driver__input"
                  type={showPasswordFields ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={changingPassword}
                />
              </label>
            </div>

            <p className="hub-driver__password-meta">{PASSWORD_HELP_TEXT}</p>

            <div className="hub-driver__form-actions">
              <button
                type="button"
                className="hub-driver__linkbtn"
                onClick={() => setShowPasswordFields((current) => !current)}
                disabled={changingPassword}
              >
                {showPasswordFields ? "Hide passwords" : "Show passwords"}
              </button>
            </div>

            {passwordError ? (
              <p className="form-error-message" role="alert">
                {passwordError}
              </p>
            ) : null}

            <div className="hub-driver__form-actions">
              <button type="submit" className="btn btn--primary btn--block" disabled={changingPassword}>
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}