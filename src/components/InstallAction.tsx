import { useAppInstall } from "../legacy/lib/appInstall";
import { useLanguage } from "../legacy/lib/i18n";

/**
 * Shared install guidance dialog (part of the single PWA install system:
 * manifest + sw.js + useAppInstall). Rendered by the BottomNav
 * "Add Home Screen" fallback when the browser exposes no native prompt.
 * iOS/Safari gets Share → Add to Home Screen steps; other unsupported
 * browsers get a graceful note. Never a fake button.
 */
export function InstallHelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { isIOS } = useAppInstall();

  return (
    <div
      className="install-help"
      role="dialog"
      aria-label={t("install.title")}
    >
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
      <button type="button" className="link-button" onClick={onClose}>
        {t("install.close")}
      </button>
    </div>
  );
}
