import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AppHeader({ trailing }: { trailing?: ReactNode }) {
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
          {trailing}
          <span className="app-header__city" aria-hidden="true">
            Bislig City
          </span>
        </div>
      </div>
    </header>
  );
}
