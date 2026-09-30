import type { DriverJob } from "../jobs";
import { JobCountdown } from "./JobCountdown";
import { JobTypeBadge } from "./JobTypeBadge";

export function JobCard({
  job,
  busy,
  onAccept,
  onDecline,
  onDismiss,
  onExpire,
}: {
  job: DriverJob;
  busy: boolean;
  onAccept: () => void;
  onDecline?: () => void;
  onDismiss?: () => void;
  onExpire: () => void;
}) {
  const isRide = job.kind === "ride";
  const isDelivery = job.kind === "delivery";
  const isPakyawan = job.kind === "pakyawan";
  const hasFare = "fare" in job ? job.fare : job.price;

  return (
    <article className="hub-driver__job" aria-label={`${job.kind} job`}>
      <div className="hub-driver__job-top">
        <JobTypeBadge kind={job.kind} />
        {job.expiresAt ? (
          <JobCountdown expiresAt={job.expiresAt} onExpire={onExpire} />
        ) : null}
      </div>

      <div className="hub-driver__job-meta">
        {isRide && (
          <p className="hub-driver__job-kind">New ride request</p>
        )}
        {isDelivery && (
          <p className="hub-driver__job-kind">Delivery request</p>
        )}
        {isPakyawan && (
          <p className="hub-driver__job-kind">Pakyawan request</p>
        )}

        <p className="hub-driver__job-route">
          <span className="hub-driver__job-stop">
            <span className="hub-driver__job-stop-label" aria-hidden="true">Pickup</span>
            {job.pickup}
          </span>
          <span className="hub-driver__job-arrow" aria-hidden="true">↓</span>
          <span className="hub-driver__job-stop">
            <span className="hub-driver__job-stop-label" aria-hidden="true">Drop</span>
            {job.destination}
          </span>
        </p>

        {hasFare ? (
          <p className="hub-driver__job-fare">
            {hasFare}
          </p>
        ) : (
          <p className="hub-driver__job-fare hub-driver__job-fare--tbd">
            Fare confirmed on accept
          </p>
        )}

        <p className="hub-driver__card-sub">{job.meta}</p>
      </div>

      <div className="hub-driver__job-actions">
        <button
          type="button"
          className="btn btn--primary btn--block hub-driver__job-accept"
          disabled={busy}
          onClick={onAccept}
        >
          {busy
            ? "Working…"
            : job.kind === "ride"
            ? "Accept ride"
            : "Accept"}
        </button>
        {onDecline ? (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            disabled={busy}
            onClick={onDecline}
          >
            Decline
          </button>
        ) : null}
        {!onDecline && onDismiss ? (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            disabled={busy}
            onClick={onDismiss}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </article>
  );
}