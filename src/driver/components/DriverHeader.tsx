import { Link } from "react-router-dom";
import { LanguageToggle } from "../../legacy/components/LanguageToggle";

export function DriverHeader({
  name,
  online,
}: {
  name: string | null;
  online: boolean;
}) {
  return (
    <header className="hub-driver__header" role="banner">
      <Link to="/" className="hub-driver__brand" aria-label="Bislig Hub — Home">
        <img
          src="/assets/bislig-hub-logo.png"
          alt="Bislig Hub"
          className="hub-driver__logo"
          width={120}
          height={30}
          decoding="async"
        />
      </Link>
      <div className="hub-driver__header-right">
        {name ? (
          <span className="hub-driver__who" aria-label="Signed in driver">
            <span
              className={`hub-driver__dot${online ? " is-on" : ""}`}
              aria-hidden="true"
            />
            {name.split(" ")[0]}
          </span>
        ) : null}
        <LanguageToggle />
      </div>
    </header>
  );
}
