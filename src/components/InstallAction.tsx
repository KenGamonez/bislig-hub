import { useState } from "react";
import { useAppInstall } from "../legacy/lib/appInstall";
import { useLanguage } from "../legacy/lib/i18n";

/**
 * Real PWA install action for the Hub home dashboard.
 * - Chromium/desktop: captures beforeinstallprompt, invokes native prompt.
 * - iOS/Safari: shows Share → Add to Home Screen guidance.
 * - Already installed: shows a quiet note instead of the button.
 * - Unsupported: shows a graceful fallback note, never broken UI.
 */
export function InstallAction() {
  const { t } = useLanguage();
  const { canInstall, isInstalled, isIOS, promptInstall } = useAppInstall();
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isInstalled) {
    return <p className="install-note">{t("install.installedNote")}</p>;
  }

  const handleTap = async () => {
    if (canInstall) {
      setBusy(true);
      try {
        await promptInstall();
      } finally {
        setBusy(false);
      }
      return;
    }
    setShowHelp((current) => !current);
  };

  return (
    <div className="install-action">
      <button
        type="button"
        className="btn btn--ghost btn--compact"
        onClick={() => void handleTap()}
        disabled={busy}
        aria-expanded={showHelp}
      >
        {busy ? "…" : `⬇ ${t("nav.install")}`}
      </button>

      {showHelp && !canInstall && (
        <div className="install-help" role="dialog" aria-label={t("install.title")}>
          <p className="install-help__title">{t("install.title")}</p>
          {isIOS ? (
            <ol className="install-help__steps">
              <li>{t("install.iosStep1")}</li>
              <li>{t("install.iosStep2")}</li>
              <li>{t("install.iosStep3")}</li>
            </ol>
          ) : (
            <p className="install-help__text">{t("install.unsupportedNote")}</p>
          )}
          <button
            type="button"
            className="link-button"
            onClick={() => setShowHelp(false)}
          >
            {t("install.close")}
          </button>
        </div>
      )}
    </div>
  );
}
