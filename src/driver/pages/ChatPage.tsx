import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChatRoom } from "../../components/ChatRoom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useDriverSession } from "../hooks/useDriverSession";
import {
  fetchMyMemberships,
  fetchOrganization,
} from "../../org/orgData";

/**
 * Driver chatroom: the single shared live room of the driver's
 * organization. Forum topics/threads are intentionally NOT exposed here —
 * drivers talk in the room; structured discussion stays admin-side.
 */
export function ChatPage() {
  const session = useDriverSession();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const driverId =
    session.status === "active" ? session.driver.id : null;
  const authUserId =
    session.status === "active" ? session.authUserId : null;

  const load = useCallback(async () => {
    if (!driverId) return;
    const memberships = await fetchMyMemberships(driverId);
    if (memberships.length === 0) {
      setOrgId(null);
      return;
    }
    const firstOrgId = memberships[0].org_id;
    setOrgId(firstOrgId);
    try {
      const org = await fetchOrganization(firstOrgId);
      if (org) setOrgName(org.name);
    } catch {
      // Organization name is decorative; the room works without it.
    }
  }, [driverId]);

  useEffect(() => {
    if (session.status !== "active") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void load()
      .catch((loadError: unknown) => {
        console.error("Unable to load chatroom:", loadError);
        setError("Unable to load chat right now. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [session.status, load]);

  if (session.status === "loading" || loading) {
    return (
      <DriverPage title="Chat" kicker="Driver">
        <LoadingState label="Loading chat…" />
      </DriverPage>
    );
  }

  if (session.status !== "active") {
    return (
      <DriverPage title="Chat" kicker="Driver">
        <EmptyState
          title={
            session.status === "blocked"
              ? "Account inactive"
              : "Sign in to drive"
          }
          body="Your organization chatroom appears here once you're signed in."
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
      <DriverPage title="Chat" kicker="Driver">
        <EmptyState
          title="Chat unavailable"
          body={error}
          action={
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                setLoading(true);
                setError("");
                void load()
                  .catch(() =>
                    setError("Unable to load chat right now. Please try again.")
                  )
                  .finally(() => setLoading(false));
              }}
            >
              Retry
            </button>
          }
        />
      </DriverPage>
    );
  }

  if (!orgId) {
    return (
      <DriverPage title="Chat" kicker="Driver">
        <EmptyState
          title="No organization yet"
          body="Join a driver organization to chat with your group."
        />
      </DriverPage>
    );
  }

  return (
    <DriverPage title="Chat" kicker="Driver">
      <div className="hub-driver__card">
        <ChatRoom
          orgId={orgId}
          orgName={orgName || "Organization chatroom"}
          authUserId={authUserId}
          isAdmin={false}
          heading="TODA Chat"
          description="Live room for member drivers and organization admins. Messages expire after 24 hours."
        />
      </div>
    </DriverPage>
  );
}
