import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { StatusPill } from "../components/StatusPill";
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
 * Driver home: greeting, live status, current job (if any), quick
 * actions, and the latest BTRP TODA announcement. Thin composition of
 * existing hooks and queries — no new backend.
 */
export function HomePage() {
  const session = useDriverSession();
  const { online } = useDriverPresenceContext();
  const [jobCount, setJobCount] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [latestNews, setLatestNews] = useState<OrgAnnouncement | null>(null);

  const driverId =
    session.status === "active" ? session.driver.id : null;
  const authUserId =
    session.status === "active" ? session.authUserId : null;

  useEffect(() => {
    if (!driverId) {
      setJobsLoading(false);
      return;
    }
    let cancelled = false;
    setJobsLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
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

  const firstName = session.driver.full_name.split(" ")[0];

  return (
    <DriverPage title="Home" kicker="Driver">
      <div className="hub-driver__card">
        <p className="hub-driver__panel-label">WELCOME BACK</p>
        <h3 style={{ margin: "4px 0 8px" }}>Kamusta, {firstName}.</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusPill tone={online ? "success" : "neutral"}>
            {online ? "Online" : "Offline"}
          </StatusPill>
          <StatusPill tone={jobCount > 0 ? "warn" : "neutral"}>
            {jobsLoading
              ? "Checking jobs…"
              : jobCount > 0
                ? `${jobCount} active job${jobCount === 1 ? "" : "s"}`
                : "No active jobs"}
          </StatusPill>
        </div>
      </div>

      {jobCount > 0 ? (
        <div className="hub-driver__card">
          <p className="hub-driver__panel-label">CURRENT JOB</p>
          <p style={{ margin: "4px 0 12px" }}>
            You have {jobCount} active job{jobCount === 1 ? "" : "s"} waiting
            for you.
          </p>
          <Link to="/driver/active" className="btn btn--primary btn--block">
            Open active job
          </Link>
        </div>
      ) : (
        <div className="hub-driver__card">
          <p className="hub-driver__panel-label">READY TO EARN</p>
          <p style={{ margin: "4px 0 12px" }}>
            {online
              ? "You're online. New requests will appear in Work."
              : "Go online from Work to start receiving requests."}
          </p>
          <Link to="/driver/jobs" className="btn btn--primary btn--block">
            {online ? "View work" : "Go to work"}
          </Link>
        </div>
      )}

      {latestNews ? (
        <div className="hub-driver__card">
          <p className="hub-driver__panel-label">LATEST NEWS</p>
          <h3 style={{ margin: "4px 0 8px" }}>{latestNews.title}</h3>
          <Link to="/driver/news" className="btn btn--ghost btn--block">
            Read news
          </Link>
        </div>
      ) : null}

      <div className="hub-driver__card">
        <p className="hub-driver__panel-label">QUICK ACTIONS</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 8,
          }}
        >
          <Link to="/driver/jobs" className="btn btn--ghost btn--block">
            Work
          </Link>
          <Link to="/driver/news" className="btn btn--ghost btn--block">
            News
          </Link>
          <Link to="/driver/chat" className="btn btn--ghost btn--block">
            Chat
          </Link>
          <Link to="/driver/you" className="btn btn--ghost btn--block">
            Profile
          </Link>
        </div>
      </div>
    </DriverPage>
  );
}
