import { Link } from "react-router-dom";
import { LanguageToggle } from "../legacy/components/LanguageToggle";

export function AppHeader() {
  return (
    <header className="app-header" role="banner">
      <div className="app-header__inner">
        <Link to="/" className="app-header__brand" aria-label="Bislig Hub — Home">
          <img
            src="/assets/bislig-hub-logo.png"
            alt="Bislig Hub"
            className="app-header__logo"
            width={148}
            height={36}
            decoding="async"
          />
        </Link>

        <div className="app-header__right">
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
