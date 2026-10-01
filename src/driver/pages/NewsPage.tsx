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

  const [latest, ...rest] = items;

  return (
    <DriverPage title="News" kicker="BTRP TODA notices">
      <article className="hub-driver__card hub-driver__notice hub-driver__notice--latest" aria-label="Latest notice">
        <p className="hub-driver__notice-eyebrow">
          <span className="hub-driver__notice-badge">Latest</span>
          {latest.published_at ? (
            <time className="hub-driver__notice-time">
              {formatStamp(latest.published_at)}
            </time>
          ) : null}
        </p>
        <h2 className="hub-driver__notice-title">{latest.title}</h2>
        <p className="hub-driver__notice-body">{latest.body}</p>
        {latest.image_url ? (
          <img
            src={latest.image_url}
            alt=""
            loading="lazy"
            className="hub-driver__notice-image"
          />
        ) : null}
      </article>

      {rest.map((item) => (
        <article key={item.id} className="hub-driver__card hub-driver__notice" aria-label={item.title}>
          <p className="hub-driver__notice-eyebrow">
            <span className="hub-driver__notice-org">BTRP TODA</span>
            {item.published_at ? (
              <time className="hub-driver__notice-time">
                {formatStamp(item.published_at)}
              </time>
            ) : null}
          </p>
          <h3 className="hub-driver__notice-title hub-driver__notice-title--sm">{item.title}</h3>
          <p className="hub-driver__notice-body">{item.body}</p>
          {item.image_url ? (
            <img
              src={item.image_url}
              alt=""
              loading="lazy"
              className="hub-driver__notice-image"
            />
          ) : null}
        </article>
      ))}
    </DriverPage>
  );
}
