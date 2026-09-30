import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../legacy/lib/supabase";
import { timeAgo } from "../notifications/notifications";
import {
  deleteChatMessage,
  fetchChatMessages,
  sendChatMessage,
  type ChatMessage,
} from "../org/orgData";
import "./chatroom.css";

function formatStamp(value: string): string {
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? timeAgo(stamp) : "";
}

/**
 * ONE shared BTRP organization chatroom, rendered by both the driver app
 * and the org console. Organization-scoped server-side (membership/admin
 * RLS + send RPC); reads always stay inside the trailing 24-hour window
 * and expired rows are deleted server-side by pg_cron.
 */
export function ChatRoom({
  orgId,
  orgName,
  authUserId,
  isAdmin,
  heading = "Organization chatroom",
  description = "Live room for member drivers and organization admins. Messages expire after 24 hours.",
}: {
  orgId: string;
  orgName: string;
  authUserId: string | null;
  isAdmin: boolean;
  heading?: string;
  description?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const stickRef = useRef(true);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchChatMessages(orgId));
      setError("");
    } catch (loadError) {
      console.error("Unable to load chatroom:", loadError);
      setError("Unable to load messages right now. Please try again.");
    }
  }, [orgId]);

  useEffect(() => {
    setLoading(true);
    stickRef.current = true;
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`btrp-chat-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "btrp_chat_messages",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((current) => {
            if (current.some((item) => item.id === row.id)) return current;
            return [...current, row].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "btrp_chat_messages",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const gone = (payload.old as { id?: string }).id;
          if (!gone) {
            void load();
            return;
          }
          setMessages((current) =>
            current.filter((item) => item.id !== gone)
          );
        }
      )
      .subscribe((status, subscribeError) => {
        if (subscribeError) {
          console.error("Chatroom realtime error:", subscribeError);
        }
        void status;
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, load]);

  useEffect(() => {
    if (stickRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    stickRef.current =
      list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  };

  const handleSend = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!draft.trim()) {
      setDraftError("Write a message first.");
      return;
    }
    setSending(true);
    setDraftError("");
    try {
      const sent = await sendChatMessage(orgId, draft.trim());
      setDraft("");
      stickRef.current = true;
      setMessages((current) => {
        if (current.some((item) => item.id === sent.id)) return current;
        return [...current, sent];
      });
    } catch (sendError) {
      console.error("Unable to send chat message:", sendError);
      setDraftError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to send your message. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (message: ChatMessage) => {
    setDeletingId(message.id);
    try {
      await deleteChatMessage(message.id);
      setMessages((current) =>
        current.filter((item) => item.id !== message.id)
      );
    } catch (deleteError) {
      console.error("Unable to delete chat message:", deleteError);
      setDraftError("Unable to delete that message. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="btrp-chat">
      <div className="btrp-chat__head">
        <p className="btrp-chat__eyebrow">{orgName}</p>
        <h3 className="btrp-chat__title">{heading}</h3>
        <p className="btrp-chat__sub">{description}</p>
      </div>

      {loading ? (
        <div className="loading-block" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading messages…</p>
        </div>
      ) : error && messages.length === 0 ? (
        <div className="btrp-chat__empty">
          <p className="btrp-chat__empty-title">Chat unavailable</p>
          <p className="btrp-chat__empty-text">{error}</p>
          <button
            type="button"
            className="btn btn--ghost btn--compact"
            onClick={() => {
              setLoading(true);
              setError("");
              void load().finally(() => setLoading(false));
            }}
            style={{ marginTop: 12 }}
          >
            Retry
          </button>
        </div>
      ) : messages.length === 0 ? (
        <div className="btrp-chat__empty">
          <p className="btrp-chat__empty-title">No messages yet</p>
          <p className="btrp-chat__empty-text">
            Say hello — your message appears here for the last 24 hours.
          </p>
        </div>
      ) : (
        <ul
          className="btrp-chat__list"
          ref={listRef}
          onScroll={handleScroll}
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.map((item) => {
            const mine =
              authUserId !== null && item.sender_auth_id === authUserId;
            return (
              <li key={item.id} className="btrp-chat__msg">
                <div className="btrp-chat__meta">
                  <span className="btrp-chat__name">
                    {mine ? "You" : item.sender_name}
                  </span>
                  <span
                    className={`btrp-chat__role btrp-chat__role--${item.sender_role}`}
                  >
                    {item.sender_role === "admin" ? "Admin" : "Driver"}
                  </span>
                  <span className="btrp-chat__time">
                    {formatStamp(item.created_at)}
                  </span>
                </div>
                <p className="btrp-chat__text">{item.message}</p>
                {isAdmin && !mine ? (
                  <div className="btrp-chat__msg-actions">
                    <button
                      type="button"
                      className="btrp-chat__action"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item)}
                    >
                      {deletingId === item.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="btrp-chat__composer"
        onSubmit={(event) => void handleSend(event)}
      >
        <input
          className="btrp-chat__input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message…"
          maxLength={500}
          autoComplete="off"
          aria-label="Write a chat message"
          disabled={sending}
        />
        <button
          type="submit"
          className="btrp-chat__send"
          disabled={sending || !draft.trim()}
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
      {draftError ? (
        <p className="btrp-chat__error" role="alert">
          {draftError}
        </p>
      ) : null}
    </div>
  );
}
