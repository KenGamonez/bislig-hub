import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useDriverSession } from "../hooks/useDriverSession";
import { useDriverPresenceContext } from "../hooks/useDriverPresenceContext";
import { fetchAssignedRidesForDriver } from "../../legacy/lib/rides";
import { fetchDriverPakyawanBookings } from "../../legacy/lib/scheduledBookings";
import { fetchDriverDeliveries } from "../../legacy/lib/deliveries";
import {
  fetchMyMemberships,
  fetchPublishedAnnouncementsForMember,
  type OrgAnnouncement,
} from "../../org/orgData";

/**
 * Driver home: premium dashboard with clear status hierarchy,
 * active job focus, and intentional quick actions.
 */
export function HomePage() {
  const session = useDriverSession();
  const { online } = useDriverPresenceContext();
  const [jobCount, setJobCount] = useState(0);
  const [latestNews, setLatestNews] = useState<OrgAnnouncement | null>(null);

  const driverId =
    session.status === "active" ? session.driver.id : null;
  const authUserId =
    session.status === "active" ? session.authUserId : null;

  useEffect(() => {
    if (!driverId) {
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchAssignedRidesForDriver(driverId).catch(() => []),
      fetchDriverPakyawanBookings(driverId).catch(() => []),
      fetchDriverDeliveries(driverId).catch(() => []),
    ])
      .then(([rides, pakyawan, deliveries]) => {
        if (!cancelled) setJobCount(rides.length + pakyawan.length + deliveries.length);
      })
      .catch(() => {
        if (!cancelled) setJobCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  useEffect(() => {
    if (!driverId || !authUserId) return;
    let cancelled = false;
    void fetchMyMemberships(driverId)
      .then((memberships) => {
        if (cancelled || memberships.length === 0) return;
        return fetchPublishedAnnouncementsForMember(authUserId);
      })
      .then((items) => {
        if (!cancelled && items && items.length > 0) setLatestNews(items[0]);
      })
      .catch(() => {
        // News is a courtesy block; failures stay silent here.
      });
    return () => {
      cancelled = true;
    };
  }, [driverId, authUserId]);

  if (session.status === "loading") {
    return (
      <DriverPage title="Home" kicker="Driver">
        <LoadingState label="Loading your workspace…" />
      </DriverPage>
    );
  }

  if (session.status !== "active") {
    return (
      <DriverPage title="Home" kicker="Driver">
        <EmptyState
          title={
            session.status === "blocked"
              ? "Account inactive"
              : "Sign in to drive"
          }
          body="Your home, work, news, and profile live here once you're signed in."
          action={
            <Link to="/driver/login" className="btn btn--primary btn--block">
              Go to driver sign in
            </Link>
          }
        />
      </DriverPage>
    );
  }

  const driver = session.driver;
  const firstName = driver.full_name.split(" ")[0];
  const hasActiveJob = jobCount > 0;

  return (
    <DriverPage title="Home" kicker="Driver">
      {/* Hero: greeting + status */}
      <div className="hub-driver__card hub-driver__card--hero">
        <div className="hub-driver__hero-head">
          <div>
            <p className="hub-driver__kicker">Welcome back</p>
            <h2 className="hub-driver__title">Kamusta, {firstName}.</h2>
          </div>
          <div className="hub-driver__status-badge" aria-label={online ? "Online" : "Offline"}>
            <span className={`hub-driver__dot ${online ? "is-on" : ""}`} aria-hidden="true" />
            <span className="hub-driver__status-text">{online ? "Online" : "Offline"}</span>
          </div>
        </div>

        {hasActiveJob ? (
          <>
            <div className="hub-driver__active-job-summary">
              <span className="hub-driver__job-count">{jobCount}</span>
              <span className="hub-driver__job-label">
                active job{jobCount === 1 ? "" : "s"}
              </span>
            </div>
            <Link to="/driver/active" className="btn btn--primary btn--block hub-driver__primary-cta">
              View active job
            </Link>
          </>
        ) : (
          <>
            <p className="hub-driver__ready-text">
              {online
                ? "You're online. New requests will appear in Work."
                : "Go online from Work to start receiving requests."}
            </p>
            <Link to="/driver/jobs" className="btn btn--primary btn--block hub-driver__primary-cta">
              {online ? "View work" : "Go to work"}
            </Link>
          </>
        )}
      </div>

      {/* Latest BTRP announcement */}
      {latestNews ? (
        <div className="hub-driver__card">
          <p className="hub-driver__panel-label">LATEST NEWS</p>
          <h3 style={{ margin: "4px 0 8px" }}>{latestNews.title}</h3>
          <Link to="/driver/news" className="btn btn--ghost btn--block">
            Read news
          </Link>
        </div>
      ) : null}

      {/* Quick actions grid */}
      <div className="hub-driver__card">
        <p className="hub-driver__panel-label">QUICK ACTIONS</p>
        <div className="hub-driver__actions-grid">
          <Link to="/driver/jobs" className="hub-driver__action-btn">
            <span className="hub-driver__action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </span>
            <span className="hub-driver__action-label">Work</span>
          </Link>
          <Link to="/driver/news" className="hub-driver__action-btn">
            <span className="hub-driver__action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10v4l3 .5V9.5L4 10Z" />
                <path d="M7 9.5 18 5v13l-11-4.5" />
                <path d="M9.5 14.5 10 19a1.5 1.5 0 0 0 3 0l-.5-4" />
              </svg>
            </span>
            <span className="hub-driver__action-label">News</span>
          </Link>
          <Link to="/driver/chat" className="hub-driver__action-btn">
            <span className="hub-driver__action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span className="hub-driver__action-label">Chat</span>
          </Link>
          <Link to="/driver/you" className="hub-driver__action-btn">
            <span className="hub-driver__action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span className="hub-driver__action-label">Profile</span>
          </Link>
        </div>
      </div>
    </DriverPage>
  );
}