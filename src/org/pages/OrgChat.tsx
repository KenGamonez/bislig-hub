import { Link, useParams } from "react-router-dom";
import { ChatRoom } from "../../components/ChatRoom";
import { OrgGuard } from "../OrgGuard";
import { OrgPageHead } from "../components/OrgPageHead";
import { useOrgAdmin } from "../useOrgAdmin";
import type { OrgRecord } from "../orgData";

/**
 * Dedicated organization chatroom route: the same shared live room
 * drivers see, rendered for organization admins with moderation.
 * Discussion topics remain on the Forum page.
 */
export function OrgChat() {
  const { slug } = useParams();

  return (
    <OrgGuard slug={slug}>
      {(org) => <ChatBody org={org} />}
    </OrgGuard>
  );
}

function ChatBody({ org }: { org: OrgRecord }) {
  const session = useOrgAdmin();
  const authUserId =
    session.status === "active" ? session.authUserId : null;

  return (
    <>
      <OrgPageHead
        eyebrow={`${org.name} · Engagement`}
        title="Chat"
        description="Live room for member drivers and organization admins."
        actions={
          <Link
            to={`/org/${org.slug}/forum`}
            className="btn btn--ghost btn--compact"
          >
            Discussion topics
          </Link>
        }
      />

      <div className="orgx-grid orgx-grid--single">
        <section className="orgx-panel">
          <div className="orgx-panel__body">
            <ChatRoom
              orgId={org.id}
              orgName={org.name}
              authUserId={authUserId}
              isAdmin
              heading="TODA Chat"
              description="Live room for member drivers and organization admins. Messages expire after 24 hours."
            />
          </div>
        </section>
      </div>
    </>
  );
}
