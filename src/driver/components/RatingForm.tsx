import { useState } from "react";
import {
  hasRatedRide,
  submitPassengerRating,
} from "../../legacy/lib/rides";

function friendlyError(error: unknown): string {
  if (import.meta.env.DEV) console.error("[driver-rating]", error);
  const message = error instanceof Error ? error.message : "";
  if (/already/i.test(message)) return "You already rated this passenger.";
  if (/eligible|completed/i.test(message)) {
    return "This ride can't be rated.";
  }
  return "Couldn't submit your rating. Please try again.";
}

/**
 * Optional passenger rating reusing submitPassengerRating + hasRatedRide.
 * Never blocks leaving the screen; backend owns eligibility.
 */
export function RatingForm({
  rideId,
  driverId,
  onDone,
}: {
  rideId: string;
  driverId: string;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"ready" | "sending" | "sent" | "already">(
    "ready"
  );
  const [error, setError] = useState("");

  const submit = async () => {
    if (stars < 1 || stars > 5 || state !== "ready") return;
    setState("sending");
    setError("");
    try {
      if (await hasRatedRide(rideId, driverId)) {
        setState("already");
        return;
      }
      await submitPassengerRating(
        rideId,
        driverId,
        stars,
        comment.trim() || undefined
      );
      setState("sent");
      onDone();
    } catch (err) {
      setState("ready");
      setError(friendlyError(err));
    }
  };

  if (state === "sent" || state === "already") {
    return (
      <p className="hub-driver__thanks" role="status">
        {state === "sent" ? "Thanks — rating saved." : "Already rated."}
      </p>
    );
  }

  return (
    <div className="hub-driver__rating">
      <p className="hub-driver__card-title">Rate passenger</p>
      <div className="hub-driver__stars" role="group" aria-label="Rate 1 to 5 stars">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={`hub-driver__star${value <= stars ? " is-on" : ""}`}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            aria-pressed={value === stars}
            disabled={state === "sending"}
            onClick={() => setStars(value)}
          >
            ★
          </button>
        ))}
      </div>
      <label className="hub-driver__field">
        <span>Comment (optional)</span>
        <input
          type="text"
          value={comment}
          maxLength={200}
          placeholder="Anything to add?"
          disabled={state === "sending"}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      {error ? (
        <p className="form-error-message" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={state === "sending" || stars < 1}
        onClick={() => void submit()}
      >
        {state === "sending" ? "Sending…" : "Submit rating"}
      </button>
    </div>
  );
}
