import { Link } from "react-router-dom";

export function RideNow() {
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
          <div className="placeholder__icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M6 14a2 2 0 1 0 0.01 0A2 2 0 0 0 6 14ZM18 14a2 2 0 1 0 0.01 0A2 2 0 0 0 18 14Z" stroke="currentColor" strokeWidth="1.7" />
              <path d="M6 14H4.2a1.2 1.2 0 0 1-1.2-1.2V9.2A2 2 0 0 1 5 7.2h10.2L17.8 10a1.1 1.1 0 0 1 .2.6V12.8a1.2 1.2 0 0 1-1.2 1.2H18" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="placeholder__kicker">Transport · Ride Now</p>
          <h1 className="placeholder__title">Ride Now</h1>
          <p className="placeholder__subtitle">Request a ride around Bislig. The booking workflow lands in the next phase — connected to the existing Bislig Ride system.</p>
        </header>

        <div className="placeholder__card">
          <h2 className="placeholder__card-title">What’s next</h2>
          <ul className="placeholder__list">
            <li>Pickup & destination with live location</li>
            <li>Live fare estimate before you confirm</li>
            <li>Driver assignment via Bislig Ride dispatch</li>
          </ul>
          <div className="placeholder__badge">Phase 3 — Supabase integration</div>
        </div>

        <div className="placeholder__actions">
          <Link to="/" className="btn btn--primary">
            Back to Home
          </Link>
          <p className="placeholder__hint">No booking is created on this screen — this is a preview only.</p>
        </div>
      </div>
    </div>
  );
}
