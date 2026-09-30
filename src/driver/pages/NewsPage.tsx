import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useDriverSession } from "../hooks/useDriverSession";
import {
  fetchMyMemberships,
  fetchPublishedAnnouncementsForMember,
  type OrgAnnouncement,
} from "../../org/orgData";
import { timeAgo } from "../../notifications/notifications";

function formatStamp(value: string): string {
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? timeAgo(stamp) : "";
}

/**
 * Driver news: published BTRP TODA announcements only. Reuses the
 * existing member announcements query — no new backend.
 */
export function NewsPage() {
  const session = useDriverSession();
  const [items, setItems] = useState<OrgAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const driverId =
    session.status === "active" ? session.driver.id : null;
  const authUserId =
    session.status === "active" ? session.authUserId : null;

  const load = useCallback(async () => {
    if (!driverId || !authUserId) return;
    try {
      const memberships = await fetchMyMemberships(driverId);
      if (memberships.length === 0) {
        setItems([]);
      } else {
        setItems(await fetchPublishedAnnouncementsForMember(authUserId));
      }
      setError("");
    } catch (loadError) {
      console.error("Unable to load driver news:", loadError);
      setError("Unable to load news right now. Please try again.");
    }
  }, [driverId, authUserId]);

  useEffect(() => {
    if (session.status !== "active") {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [session.status, load]);

  if (session.status === "loading" || loading) {
    return (
      <DriverPage title="News" kicker="Driver">
        <LoadingState label="Loading news…" />
      </DriverPage>
    );
  }

  if (session.status !== "active") {
    return (
      <DriverPage title="News" kicker="Driver">
        <EmptyState
          title={
            session.status === "blocked"
              ? "Account inactive"
              : "Sign in to drive"
          }
          body="Organization news appears here once you're signed in."
          action={
            <Link to="/driver/login" className="btn btn--primary btn--block">
              Go to driver sign in
            </Link>
          }
        />
      </DriverPage>
    );
  }

  if (error) {
    return (
      <DriverPage title="News" kicker="Driver">
        <EmptyState
          title="News unavailable"
          body={error}
          action={
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                setLoading(true);
                void load().finally(() => setLoading(false));
              }}
            >
              Retry
            </button>
          }
        />
      </DriverPage>
    );
  }

  if (items.length === 0) {
    return (
      <DriverPage title="News" kicker="Driver">
        <EmptyState
          title="No news yet"
          body="Announcements from your organization will appear here."
        />
      </DriverPage>
    );
  }

  return (
    <DriverPage title="News" kicker="Driver">
      {items.map((item) => (
        <article key={item.id} className="hub-driver__card">
          <p className="hub-driver__panel-label">
            {item.published_at ? formatStamp(item.published_at) : ""}
          </p>
          <h3 style={{ margin: "4px 0 8px" }}>{item.title}</h3>
          <p style={{ margin: "0 0 4px", whiteSpace: "pre-wrap" }}>
            {item.body}
          </p>
          {item.image_url ? (
            <img
              src={item.image_url}
              alt=""
              loading="lazy"
              style={{ width: "100%", borderRadius: 12, marginTop: 8 }}
            />
          ) : null}
        </article>
      ))}
    </DriverPage>
  );
}
