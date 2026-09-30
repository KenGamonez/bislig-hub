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
    <>
      <div className="orgx-pagehead">
        <div>
          <p className="orgx-eyebrow">{org.name} · Engagement</p>
          <h1 className="orgx-title">Forum</h1>
          <p className="orgx-sub">
            {topics.length} topic{topics.length === 1 ? "" : "s"} · group
            discussion for {org.name}.
          </p>
        </div>
        <div className="orgx-pagehead__actions">
          {!loading && !error && !showForm ? (
            <button
              type="button"
              className="btn btn--primary btn--compact"
              onClick={() => {
                setShowForm(true);
                setFormError("");
              }}
            >
              New topic
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="loading-block" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading topics…</p>
        </div>
      ) : error ? (
        <div className="orgx-panel">
          <div className="orgx-panel__body">
            <div className="orgx-error">
              <p className="form-error-message" role="alert">
                {error}
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
      ) : (
        <>
          {showForm ? (
            <section className="orgx-panel" style={{ marginBottom: 20 }}>
              <div className="orgx-panel__head">
                <h2 className="orgx-panel__title">New topic</h2>
              </div>
              <div className="orgx-panel__body">
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
                    className="btn btn--primary btn--compact"
                    disabled={saving}
                    onClick={() => void handleCreate()}
                  >
                    {saving ? "Posting…" : "Post topic"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="orgx-panel" aria-live="polite">
            <div className="orgx-panel__head">
              <h2 className="orgx-panel__title">Topics</h2>
              <span className="orgx-panel__meta">{topics.length}</span>
            </div>
            <div className="orgx-panel__body">
              {topics.length === 0 ? (
                <div className="orgx-empty">
                  <p className="orgx-empty__title">No topics yet</p>
                  <p className="orgx-empty__text">
                    Start the first discussion with “New topic” above.
                  </p>
                </div>
              ) : (
                <div className="orgx-tablewrap">
                  <table className="orgx-table">
                    <thead>
                      <tr>
                        <th scope="col">Topic</th>
                        <th scope="col">Replies</th>
                        <th scope="col">Last activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topics.map((topic) => (
                        <tr key={topic.id}>
                          <td data-label="Topic">
                            <Link
                              to={`/org/${org.slug}/forum/${topic.id}`}
                              className="orgx-rowlink"
                              style={{ textDecoration: "none", color: "inherit" }}
                            >
                              <span className="orgx-cell__primary">
                                {topic.title}
                              </span>
                            </Link>
                            <p className="orgx-cell__secondary">
                              {topic.is_pinned ? (
                                <span className="orgx-badge orgx-badge--flag">
                                  Pinned
                                </span>
                              ) : null}
                              {topic.is_closed ? (
                                <span className="orgx-badge orgx-badge--draft">
                                  Closed
                                </span>
                              ) : null}
                            </p>
                          </td>
                          <td data-label="Replies">
                            <span className="orgx-cell__primary">
                              {replyCounts[topic.id] ?? 0}
                            </span>
                          </td>
                          <td data-label="Last activity">
                            <span className="orgx-cell__secondary">
                              {lastActivity[topic.id]
                                ? timeAgo(lastActivity[topic.id])
                                : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
