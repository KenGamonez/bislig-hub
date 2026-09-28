import { useState } from "react";
import { Link } from "react-router-dom";
import {
  timeAgo,
  useNotifications,
  type NotificationService,
} from "./notifications";
import "./notifications.css";

const SERVICE_LABEL: Record<NotificationService, string> = {
  ride: "Ride Now",
  pakyawan: "Pakyawan",
  delivery: "Pa-Deliver",
};

/**
 * Reusable notification bell + center. Rendered in the passenger header,
 * the new driver header, and (via the same store) the legacy driver
 * workspace. Opens a panel with the actual notifications — never
 * decorative. Selecting an action marks that notification read.
 */
export function NotificationBell() {
  const { items, unreadCount, markAllRead, markRead, removeNotification } =
    useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="hub-notify">
      <button
        type="button"
        className="hub-notify-bell"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() => {
          if (!open) markAllRead();
          setOpen((current) => !current);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="hub-notify-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="hub-notify-panel"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="hub-notify-head">
            <strong>Notifications</strong>
            <span className="hub-notify-count">
              {items.length === 0
                ? "none"
                : `${unreadCount} unread · ${items.length} total`}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="hub-notify-empty">
              You're all caught up. New ride, trip, and delivery updates will
              appear here.
            </p>
          ) : (
            <ul className="hub-notify-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={
                    item.read
                      ? "hub-notify-item seen"
                      : "hub-notify-item"
                  }
                >
                  <div className="hub-notify-top">
                    <span className="hub-notify-service">
                      {SERVICE_LABEL[item.service]}
                    </span>
                    <span className="hub-notify-time">
                      {timeAgo(item.createdAt)}
                    </span>
                  </div>
                  <p className="hub-notify-title">{item.title}</p>
                  <p className="hub-notify-message">{item.message}</p>
                  <div className="hub-notify-actions">
                    {item.actionLabel ? (
                      <Link
                        to={item.target}
                        className="hub-notify-action"
                        onClick={() => {
                          markRead(item.id);
                          setOpen(false);
                        }}
                      >
                        {item.actionLabel}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="hub-notify-dismiss"
                      onClick={() => removeNotification(item.id)}
                      aria-label={`Dismiss ${item.title}`}
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
