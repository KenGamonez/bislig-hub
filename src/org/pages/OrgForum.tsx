import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { OrgGuard } from "../OrgGuard";
import {
  createOrgForumTopic,
  fetchOrgForumPosts,
  fetchOrgForumTopics,
  type OrgForumTopic,
  type OrgRecord,
} from "../orgData";
import { timeAgo } from "../../notifications/notifications";

export function OrgForum() {
  const { slug } = useParams();

  return (
    <OrgGuard slug={slug}>
      {(org) => <ForumBody org={org} />}
    </OrgGuard>
  );
}

function ForumBody({ org }: { org: OrgRecord }) {
  const [topics, setTopics] = useState<OrgForumTopic[]>([]);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [lastActivity, setLastActivity] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetchOrgForumTopics(org.id);
      setTopics(rows);
      const posts = await fetchOrgForumPosts(rows.map((row) => row.id));
      const counts: Record<string, number> = {};
      const activity: Record<string, number> = {};
      for (const post of posts) {
        counts[post.topic_id] = (counts[post.topic_id] ?? 0) + 1;
        const stamp = new Date(post.created_at).getTime();
        activity[post.topic_id] = Math.max(
          activity[post.topic_id] ?? 0,
          stamp
        );
      }
      setReplyCounts(counts);
      setLastActivity(activity);
      setError("");
    } catch (loadError) {
      console.error("Unable to load forum topics:", loadError);
      setError("Unable to load forum topics right now. Please try again.");
    }
  }, [org.id]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) {
      setFormError("Title and message are required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await createOrgForumTopic({
        org_id: org.id,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle("");
      setBody("");
      setShowForm(false);
      await load();
    } catch (saveError) {
      console.error("Unable to create topic:", saveError);
      setFormError("Unable to create the topic. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container">
      <section className="driver-card" aria-live="polite">
        <p className="section-label">Group forum</p>
        <h3>Forum</h3>
        {loading ? (
          <div className="loading-block" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading topics…</p>
          </div>
        ) : error ? (
          <>
            <p className="form-error-message" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => void load()}
            >
              Retry
            </button>
          </>
        ) : (
          <>
            {!showForm ? (
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={() => {
                  setShowForm(true);
                  setFormError("");
                }}
                style={{ marginTop: 8 }}
              >
                New Topic
              </button>
            ) : (
              <div style={{ marginTop: 12 }}>
                <p className="section-label">New topic</p>
                <label className="field-block">
                  <span className="field-label">Title</span>
                  <input
                    className="input-field"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                  />
                </label>
                <label className="field-block">
                  <span className="field-label">Message</span>
                  <textarea
                    className="input-field"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={4}
                  />
                </label>
                {formError ? (
                  <p className="form-error-message" role="alert">
                    {formError}
                  </p>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={saving}
                    onClick={() => void handleCreate()}
                  >
                    {saving ? "Posting…" : "Post topic"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {topics.length === 0 ? (
              <p className="muted-copy" style={{ marginTop: 12 }}>
                No topics yet. Start the first discussion above.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
                {topics.map((topic) => (
                  <li
                    key={topic.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <Link
                      to={`/org/${org.slug}/forum/${topic.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "baseline",
                        }}
                      >
                        <strong>{topic.title}</strong>
                        {topic.is_pinned ? (
                          <span className="muted-copy">· Pinned</span>
                        ) : null}
                        {topic.is_closed ? (
                          <span className="muted-copy">· Closed</span>
                        ) : null}
                      </div>
                      <p className="muted-copy" style={{ margin: "2px 0 0" }}>
                        {replyCounts[topic.id] ?? 0}{" "}
                        {(replyCounts[topic.id] ?? 0) === 1
                          ? "reply"
                          : "replies"}
                        {lastActivity[topic.id]
                          ? ` · active ${timeAgo(lastActivity[topic.id])}`
                          : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
