// Bislig Hub — shared journey progress (Phase 5, UX only).
// Renders a compact horizontal step tracker from caller-supplied stages.
// No backend terms: callers pass customer-facing labels + the current index.

export type JourneyStage = {
  label: string;
};

export function JourneySteps({
  stages,
  currentIndex,
  ariaLabel,
}: {
  stages: JourneyStage[];
  currentIndex: number;
  ariaLabel: string;
}) {
  const safeIndex = Math.max(
    0,
    Math.min(currentIndex, stages.length - 1)
  );
  return (
    <ol className="journey" aria-label={ariaLabel}>
      {stages.map((stage, i) => {
        const state =
          i < safeIndex ? "is-done" : i === safeIndex ? "is-current" : "is-todo";
        return (
          <li
            key={stage.label}
            className={`journey__step ${state}`}
            aria-current={i === safeIndex ? "step" : undefined}
          >
            <span className="journey__dot" aria-hidden="true">
              {i < safeIndex ? "✓" : i + 1}
            </span>
            <span className="journey__label">{stage.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
