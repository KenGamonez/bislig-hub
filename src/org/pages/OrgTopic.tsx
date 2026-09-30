import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import {
  createOrgForumPost,
  deleteOrgForumPost,
  deleteOrgForumTopic,
  fetchOrgForumTopic,
  fetchOrgForumTopicPosts,
  updateOrgForumPost,
  updateOrgForumTopic,
  type OrgForumPost,
  type OrgForumTopic,
  type OrgRecord,
} from "../orgData";
import { useOrgAdmin } from "../useOrgAdmin";
import { timeAgo } from "../../notifications/notifications";

function formatStamp(value: string): string {
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? timeAgo(stamp) : "—";
}

export function OrgTopic() {
  const { slug, topicId } = useParams();

  return (
    <OrgGuard slug={slug}>
      {(org) => <TopicBody org={org} topicId={topicId} />}
    </OrgGuard>
  );
}

function TopicBody({ org, topicId }: { org: OrgRecord; topicId: string | undefined }) {
  const session = useOrgAdmin();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<OrgForumTopic | null>(null);
  const [posts, setPosts] = useState<OrgForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostBody, setEditPostBody] = useState("");

  const isAdmin = session.status === "active";
  const myAuthId =
    session.status === "active" ? session.authUserId : null;

  const load = useCallback(async () => {
    if (!topicId) {
      setError("Topic not found.");
      return;
    }
    try {
      const [row, replies] = await Promise.all([
        fetchOrgForumTopic(topicId),
        fetchOrgForumTopicPosts(topicId),
      ]);
      if (!row || row.org_id !== org.id) {
        setError("Topic not found or you do not have access to it.");
        setTopic(null);
        setPosts([]);
        return;
      }
      setTopic(row);
      setPosts(replies);
      setError("");
    } catch (loadError) {
      console.error("Unable to load topic:", loadError);
      setError("Unable to load this topic right now. Please try again.");
    }
  }, [org.id, topicId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const handleReply = async () => {
    if (!topic || !reply.trim()) {
      setReplyError("Write a reply first.");
      return;
    }
    if (topic.is_closed) {
      setReplyError("This topic is closed.");
      return;
    }

    setSaving(true);
    setReplyError("");

    try {
      await createOrgForumPost({ topic_id: topic.id, body: reply.trim() });
      setReply("");
      await load();
    } catch (saveError) {
      console.error("Unable to post reply:", saveError);
      setReplyError("Unable to post your reply. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTopic = async () => {
    if (!topic || !editTitle.trim() || !editBody.trim()) {
      setReplyError("Title and message are required.");
      return;
    }

    setSaving(true);

    try {
      const updated = await updateOrgForumTopic(topic.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
      });
      setTopic(updated);
      setEditingTopic(false);
    } catch (saveError) {
      console.error("Unable to update topic:", saveError);
      setReplyError("Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async () => {
    if (!topic) return;
    setSaving(true);
    try {
      const updated = await updateOrgForumTopic(topic.id, {
        is_pinned: !topic.is_pinned,
      });
      setTopic(updated);
    } catch (saveError) {
      console.error("Unable to update pin:", saveError);
      setReplyError("Unable to update. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleClose = async () => {
    if (!topic) return;
    setSaving(true);
    try {
      const updated = await updateOrgForumTopic(topic.id, {
        is_closed: !topic.is_closed,
      });
      setTopic(updated);
    } catch (saveError) {
      console.error("Unable to update topic:", saveError);
      setReplyError("Unable to update. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!topic) return;
    if (
      !window.confirm(
        `Delete "${topic.title}" and all its replies? This cannot be undone.`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await deleteOrgForumTopic(topic.id);
      navigate(`/org/${org.slug}/forum`, { replace: true });
    } catch (deleteError) {
      console.error("Unable to delete topic:", deleteError);
      setReplyError("Unable to delete. Please try again.");
      setSaving(false);
    }
  };

  const startEditPost = (post: OrgForumPost) => {
    setEditingPostId(post.id);
    setEditPostBody(post.body);
    setReplyError("");
  };

  const handleSavePost = async (post: OrgForumPost) => {
    if (!editPostBody.trim()) {
      setReplyError("Reply cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      await updateOrgForumPost(post.id, { body: editPostBody.trim() });
      setEditingPostId(null);
      setEditPostBody("");
      await load();
    } catch (saveError) {
      console.error("Unable to update reply:", saveError);
      setReplyError("Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (post: OrgForumPost) => {
    if (!window.confirm("Delete this reply? This cannot be undone.")) {
      return;
    }

    setSaving(true);
    try {
      await deleteOrgForumPost(post.id);
      await load();
    } catch (deleteError) {
      console.error("Unable to delete reply:", deleteError);
      setReplyError("Unable to delete. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canEditTopic =
    topic !== null &&
    (isAdmin || (myAuthId !== null && topic.author_auth_user_id === myAuthId));
  const canDeleteTopic = canEditTopic;
  const canReply = topic !== null && !topic.is_closed;

  if (loading) {
    return (
      <div className="loading-block" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Loading topic…</p>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="orgx-panel">
        <div className="orgx-panel__body">
          <div className="orgx-error">
            <p className="form-error-message" role="alert">
              {error || "Topic not found."}
            </p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="orgx-pagehead">
        <div>
          <p className="orgx-eyebrow">
            <Link
              to={`/org/${org.slug}/forum`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {org.name} · Forum
            </Link>
          </p>
          <h1 className="orgx-title">{topic.title}</h1>
          <p className="orgx-sub">
            {topic.author_auth_user_id === myAuthId ? "You" : "Group member"} ·{" "}
            {formatStamp(topic.created_at)} · {posts.length}{" "}
            {posts.length === 1 ? "reply" : "replies"}
            {topic.is_pinned ? " · Pinned" : ""}
            {topic.is_closed ? " · Closed" : ""}
          </p>
        </div>
        <div className="orgx-pagehead__actions">
          <Link
            to={`/org/${org.slug}/forum`}
            className="btn btn--ghost btn--compact"
          >
            ← All topics
          </Link>
        </div>
      </div>

      <div className="orgx-grid">
        <div className="orgx-col">
          <section className="orgx-panel" aria-live="polite">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">Discussion</h2>
            </div>
            <div className="orgx-panel__body">
              {editingTopic ? (
                <>
                  <label className="field-block">
                    <span className="field-label">Title</span>
                    <input
                      className="input-field"
                      type="text"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      maxLength={120}
                    />
                  </label>
                  <label className="field-block">
                    <span className="field-label">Message</span>
                    <textarea
                      className="input-field"
                      value={editBody}
                      onChange={(event) => setEditBody(event.target.value)}
                      rows={4}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn--primary btn--compact"
                      disabled={saving}
                      onClick={() => void handleSaveTopic()}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--compact"
                      disabled={saving}
                      onClick={() => setEditingTopic(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 4px", fontSize: 15, lineHeight: 1.6 }}>
                    {topic.body}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    {canEditTopic ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--compact"
                        disabled={saving}
                        onClick={() => {
                          setEditTitle(topic.title);
                          setEditBody(topic.body);
                          setEditingTopic(true);
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--compact"
                        disabled={saving}
                        onClick={() => void handleTogglePin()}
                      >
                        {topic.is_pinned ? "Unpin" : "Pin"}
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--compact"
                        disabled={saving}
                        onClick={() => void handleToggleClose()}
                      >
                        {topic.is_closed ? "Reopen" : "Close"}
                      </button>
                    ) : null}
                    {canDeleteTopic ? (
                      <button
                        type="button"
                        className="btn btn--ghost btn--compact"
                        disabled={saving}
                        onClick={() => void handleDeleteTopic()}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="orgx-panel">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">Replies</h2>
              <span className="orgx-panel__meta">{posts.length}</span>
            </div>
            <div className="orgx-panel__body">
              {posts.length === 0 ? (
                <div className="orgx-empty">
                  <p className="orgx-empty__title">No replies yet</p>
                  <p className="orgx-empty__text">
                    Be the first to respond below.
                  </p>
                </div>
              ) : (
                <div className="orgx-tablewrap">
                  <table className="orgx-table">
                    <tbody>
                      {posts.map((post) => {
                        const mine =
                          myAuthId !== null &&
                          post.author_auth_user_id === myAuthId;
                        const canModerate = isAdmin || mine;
                        return (
                          <tr key={post.id}>
                            <td>
                              {editingPostId === post.id ? (
                                <>
                                  <label className="field-block">
                                    <span className="field-label">Edit reply</span>
                                    <textarea
                                      className="input-field"
                                      value={editPostBody}
                                      onChange={(event) =>
                                        setEditPostBody(event.target.value)
                                      }
                                      rows={3}
                                    />
                                  </label>
                                  <div
                                    style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                                  >
                                    <button
                                      type="button"
                                      className="btn btn--primary btn--compact"
                                      disabled={saving}
                                      onClick={() => void handleSavePost(post)}
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
                                  <p style={{ margin: "0 0 2px" }}>{post.body}</p>
                                  <p className="orgx-cell__secondary" style={{ margin: 0 }}>
                                    {mine ? "You" : "Group member"} ·{" "}
                                    {formatStamp(post.created_at)}
                                  </p>
                                  {canModerate ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        marginTop: 6,
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="btn btn--ghost btn--compact"
                                        disabled={saving}
                                        onClick={() => startEditPost(post)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn--ghost btn--compact"
                                        disabled={saving}
                                        onClick={() => void handleDeletePost(post)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="orgx-col">
          <section className="orgx-panel">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">Reply</h2>
            </div>
            <div className="orgx-panel__body">
              {canReply ? (
                <>
                  <label className="field-block">
                    <span className="field-label">Write a reply</span>
                    <textarea
                      className="input-field"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={3}
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
                  >
                    {saving ? "Posting…" : "Post reply"}
                  </button>
                </>
              ) : (
                <>
                  <p className="orgx-note" style={{ marginTop: 0 }}>
                    This topic is closed. No new replies can be added.
                  </p>
                  {replyError ? (
                    <p className="form-error-message" role="alert">
                      {replyError}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
