import { useRef, useState } from "react";
import { validateDriverPhoto } from "../../legacy/lib/driverProfilePhotos";
import { updateOwnProfilePhoto, uploadOrgDriverPhoto } from "../../org/orgData";
import { useDriverSession } from "../hooks/useDriverSession";

/**
 * Driver self-service profile photo. Uploads bytes to the
 * org-drivers/<driver_id>/ path (storage policies authorize the driver
 * themself) and records the URL via update_own_profile_photo. The driver
 * can only ever touch their own row — enforced DB-side.
 */
export function DriverPhotoControl() {
  const session = useDriverSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (session.status !== "active") return null;

  const driver = session.driver;
  const photoUrl = driver.profile_photo_url;

  const handleFile = async (file: File | null) => {
    setError("");
    setNotice("");
    if (!file) return;

    const validation = validateDriverPhoto(file);
    if (!validation.valid) {
      setError(validation.message ?? "Please choose an image file.");
      return;
    }

    setBusy(true);
    try {
      const uploaded = await uploadOrgDriverPhoto(driver.id, file);
      await updateOwnProfilePhoto(uploaded.publicUrl);
      setNotice("Your profile photo was updated.");
      await session.refresh();
    } catch (uploadError) {
      console.error("Unable to update profile photo:", uploadError);
      setError("Unable to update your photo. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="hub-driver__card">
      <p className="hub-driver__panel-label">PROFILE PHOTO</p>
      <div className="hub-driver__photo-row">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${driver.full_name} profile photo`}
            className="hub-driver__photo-thumb"
          />
        ) : (
          <span
            aria-hidden="true"
            className="hub-driver__photo-fallback"
          >
            {driver.full_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <button
            type="button"
            className="btn btn--ghost btn--compact"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Uploading…" : photoUrl ? "Replace photo" : "Add photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hub-driver__photo-input"
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      {error ? (
        <p className="form-error-message hub-driver__photo-msg" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="hub-driver__success hub-driver__photo-msg" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
