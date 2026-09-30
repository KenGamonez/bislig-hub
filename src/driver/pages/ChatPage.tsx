import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DriverPage } from "../components/DriverPage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useDriverSession } from "../hooks/useDriverSession";
import { supabase } from "../../legacy/lib/supabase";
import {
  createOrgForumPost,
  deleteOrgForumPost,
  fetchMyMemberships,
  fetchOrgForumTopicPosts,
  fetchOrgForumTopics,
  updateOrgForumPost,
  type OrgForumPost,
  type OrgForumTopic,
} from "../../org/orgData";
import { timeAgo } from "../../notifications/notifications";

function formatStamp(value: string): string {
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? timeAgo(stamp) : "";
}

/**
 * BTRP TODA chatroom built on the existing organization forum — no new
 * backend. Members see topics, read threads, and reply; realtime updates
 * arrive through the forum tables' realtime publication.
 */
export function ChatPage() {
  const session = useDriverSession();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [topics, setTopics] = useState<OrgForumTopic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posts, setPosts] = useState<OrgForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const driverId =
    session.status === "active" ? session.driver.id : null;
  const authUserId =
    session.status === "active" ? session.authUserId : null;

  const loadTopics = useCallback(async () => {
    if (!driverId) return;
    const memberships = await fetchMyMemberships(driverId);
    if (memberships.length === 0) {
      setOrgId(null);
      setTopics([]);
      return;
    }
    const firstOrgId = memberships[0].org_id;
    setOrgId(firstOrgId);
    const rows = await fetchOrgForumTopics(firstOrgId);
    setTopics(rows.filter((row) => !row.is_closed || row.id === selectedId));
  }, [driverId, selectedId]);

  const loadThread = useCallback(async (topicId: string) => {
    setThreadLoading(true);
    try {
      setPosts(await fetchOrgForumTopicPosts(topicId));
    } catch (loadError) {
      console.error("Unable to load thread:", loadError);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== "active") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void loadTopics()
      .catch((loadError: unknown) => {
        console.error("Unable to load chat:", loadError);
        setError("Unable to load chat right now. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [session.status, loadTopics]);

  useEffect(() => {
    if (!selectedId) {
      setPosts([]);
      return;
    }
    void loadThread(selectedId);
    const channel = supabase
      .channel(`hub-driver-forum-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "org_forum_posts",
          filter: `topic_id=eq.${selectedId}`,
        },
        () => {
          void loadThread(selectedId);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedId, loadThread]);

  const handleReply = async () => {
    if (!selectedId || !reply.trim()) {
      setReplyError("Write a message first.");
      return;
    }
    setSaving(true);
    setReplyError("");
    try {
      await createOrgForumPost({ topic_id: selectedId, body: reply.trim() });
      setReply("");
      await loadThread(selectedId);
    } catch (saveError) {
      console.error("Unable to send message:", saveError);
      setReplyError("Unable to send your message. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: OrgForumPost) => {
    setSaving(true);
    try {
      await deleteOrgForumPost(post.id);
      if (selectedId) await loadThread(selectedId);
    } catch (deleteError) {
      console.error("Unable to delete message:", deleteError);
      setReplyError("Unable to delete. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (post: OrgForumPost) => {
    if (!editBody.trim()) {
      setReplyError("Message cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateOrgForumPost(post.id, { body: editBody.trim() });
      setEditingPostId(null);
      setEditBody("");
      if (selectedId) await loadThread(selectedId);
    } catch (saveError) {
      console.error("Unable to edit message:", saveError);
      setReplyError("Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
                void loadTopics()
                  .catch(() => setError("Unable to load chat right now. Please try again."))
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

  if (!orgId || topics.length === 0) {
    return (
      <DriverPage title="Chat" kicker="Driver">
        <EmptyState
          title="No conversations yet"
          body="Your organization admin starts topics that appear here."
        />
      </DriverPage>
    );
  }

  const selected = topics.find((topic) => topic.id === selectedId) ?? null;

  return (
    <DriverPage title="Chat" kicker="Driver">
      <div className="hub-driver__card">
        <p className="hub-driver__panel-label">CONVERSATIONS</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className="btn btn--ghost btn--block"
              style={
                topic.id === selectedId
                  ? { borderColor: "var(--brand-orange)" }
                  : undefined
              }
              onClick={() => {
                setSelectedId(topic.id);
                setReply("");
                setReplyError("");
              }}
            >
              {topic.title}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="hub-driver__card">
          <p className="hub-driver__panel-label">THREAD</p>
          <h3 style={{ margin: "4px 0 8px" }}>{selected.title}</h3>
          {threadLoading ? (
            <LoadingState label="Loading messages…" />
          ) : posts.length === 0 ? (
            <p className="muted-copy">No messages yet. Say hello below.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {posts.map((post) => {
                const mine =
                  authUserId !== null &&
                  post.author_auth_user_id === authUserId;
                return (
                  <div key={post.id}>
                    {editingPostId === post.id ? (
                      <>
                        <input
                          className="hub-driver__input"
                          type="text"
                          value={editBody}
                          onChange={(event) => setEditBody(event.target.value)}
                          disabled={saving}
                          maxLength={500}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <button
                            type="button"
                            className="btn btn--primary btn--compact"
                            disabled={saving}
                            onClick={() => void handleEdit(post)}
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--compact"
                            disabled={saving}
                            onClick={() => setEditingPostId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: "0 0 2px", whiteSpace: "pre-wrap" }}>
                          {post.body}
                        </p>
                        <p className="muted-copy" style={{ margin: 0, fontSize: 12 }}>
                          {mine ? "You" : "Group member"} ·{" "}
                          {formatStamp(post.created_at)}
                        </p>
                        {mine ? (
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <button
                              type="button"
                              className="hub-driver__linkbtn"
                              disabled={saving}
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditBody(post.body);
                                setReplyError("");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="hub-driver__linkbtn"
                              disabled={saving}
                              onClick={() => void handleDelete(post)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!selected.is_closed ? (
            <div style={{ marginTop: 12 }}>
              <label className="hub-driver__field-block">
                <span className="hub-driver__field-label">Message</span>
                <input
                  className="hub-driver__input"
                  type="text"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Write a message…"
                  disabled={saving}
                  maxLength={500}
                />
              </label>
              {replyError ? (
                <p className="form-error-message" role="alert">
                  {replyError}
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={saving}
                onClick={() => void handleReply()}
                style={{ marginTop: 8 }}
              >
                {saving ? "Sending…" : "Send"}
              </button>
            </div>
          ) : (
            <p className="muted-copy" style={{ marginTop: 12 }}>
              This conversation is closed by the admin.
            </p>
          )}
        </div>
      ) : null}
    </DriverPage>
  );
}
