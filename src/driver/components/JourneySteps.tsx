const STEPS = ["Pickup", "Start", "Complete"] as const;

const INDEX_BY_STATUS: Record<string, number> = {
  accepted: 0,
  arrived: 1,
  in_progress: 2,
  completed: 3,
};

/**
 * Compact Hub-native journey indicator. Presentation only — progress is
 * derived from backend status, never stored locally. Callers may pass
 * custom steps + index for non-ride lifecycles.
 */
export function JourneySteps({
  status,
  steps = STEPS,
  currentIndex,
}: {
  status: string;
  steps?: readonly string[];
  currentIndex?: number;
}) {
  const doneThrough = currentIndex ?? INDEX_BY_STATUS[status] ?? 0;
  const terminal = status === "completed" || status === "delivered";
  return (
    <ol className="hub-driver__steps" aria-label="Trip progress">
      {steps.map((label, index) => {
        const done = index < doneThrough;
        const current = index === doneThrough && !terminal;
        return (
          <li
            key={label}
            className={`hub-driver__step${done ? " is-done" : ""}${current ? " is-current" : ""}`}
            aria-current={current ? "step" : undefined}
          >
            <span className="hub-driver__step-dot" aria-hidden="true">
              {done || terminal ? "✓" : ""}
            </span>
            <span className="hub-driver__step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
