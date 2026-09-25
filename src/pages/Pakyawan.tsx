import { Link } from "react-router-dom";

export function Pakyawan() {
  return (
    <div className="placeholder">
      <div className="container">
        <nav className="placeholder__nav" aria-label="Back">
          <Link to="/" className="back-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Home
          </Link>
        </nav>

        <header className="placeholder__header">
          <div className="placeholder__icon placeholder__icon--muted" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="7.5" width="11" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
              <path d="M14.5 10.5h3.2a1.3 1.3 0 0 1 1.3 1.3v2.4a1.3 1.3 0 0 1-1.3 1.3h-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="placeholder__kicker">Transport · Pakyawan</p>
          <h1 className="placeholder__title">Pakyawan</h1>
          <p className="placeholder__subtitle">Book a vehicle for longer trips or private use. Scheduling and quotes will be handled through the existing Pakyawan flow in a later phase.</p>
        </header>

        <div className="placeholder__card">
          <h2 className="placeholder__card-title">Planned workflow</h2>
          <ul className="placeholder__list">
            <li>Date, time, pickup & destination</li>
            <li>Passengers & trip type</li>
            <li>Admin quote → customer confirmation</li>
          </ul>
          <div className="placeholder__badge">Phase 3 — No backend call yet</div>
        </div>

        <div className="placeholder__actions">
          <Link to="/" className="btn btn--primary">
            Back to Home
          </Link>
          <p className="placeholder__hint">This page is a polished placeholder — no booking is submitted here.</p>
        </div>
      </div>
    </div>
  );
}
