const STEPS = ["Pickup", "Start", "Complete"] as const;

const INDEX_BY_STATUS: Record<string, number> = {
  accepted: 0,
  arrived: 1,
  in_progress: 2,
  completed: 3,
};

/**
 * Compact Hub-native journey indicator. Presentation only — progress is
 * derived from the backend ride status, never stored locally.
 */
export function JourneySteps({ status }: { status: string }) {
  const doneThrough = INDEX_BY_STATUS[status] ?? 0;
  return (
    <ol className="hub-driver__steps" aria-label="Trip progress">
      {STEPS.map((label, index) => {
        const done = index < doneThrough;
        const current = index === doneThrough && status !== "completed";
        return (
          <li
            key={label}
            className={`hub-driver__step${done ? " is-done" : ""}${current ? " is-current" : ""}`}
            aria-current={current ? "step" : undefined}
          >
            <span className="hub-driver__step-dot" aria-hidden="true">
              {done || status === "completed" ? "✓" : ""}
            </span>
            <span className="hub-driver__step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
