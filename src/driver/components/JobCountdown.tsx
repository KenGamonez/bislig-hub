import { useEffect, useState } from "react";

function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Visible countdown driven ONLY by the backend expires_at value.
 * Fires onExpire once when it lapses; expiry rules stay server-side.
 */
export function JobCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const left = new Date(expiresAt).getTime() - now;

  useEffect(() => {
    if (left <= 0) {
      onExpire();
      return;
    }
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  });

  if (left <= 0) return null;

  return (
    <p className="hub-driver__countdown" role="timer">
      Expires in {formatLeft(left)}
    </p>
  );
}
