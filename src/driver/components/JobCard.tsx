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
  return (
    <article className="hub-driver__job" aria-label={`${job.kind} job`}>
      <div className="hub-driver__job-top">
        <JobTypeBadge kind={job.kind} />
        {job.expiresAt ? (
          <JobCountdown expiresAt={job.expiresAt} onExpire={onExpire} />
        ) : null}
      </div>

      <p className="hub-driver__job-route">
        {job.pickup}
        <span className="hub-driver__job-arrow" aria-hidden="true">
          ↓
        </span>
        {job.destination}
      </p>

      {("fare" in job ? job.fare : job.price) ? (
        <p className="hub-driver__job-fare">
          {"fare" in job ? job.fare : job.price}
        </p>
      ) : (
        <p className="hub-driver__job-fare hub-driver__job-fare--tbd">
          Fare confirmed on accept
        </p>
      )}

      <p className="hub-driver__card-sub">{job.meta}</p>

      <div className="hub-driver__job-actions">
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy}
          onClick={onAccept}
        >
          {busy ? "Working…" : job.kind === "ride" ? "Accept ride" : "Accept"}
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
