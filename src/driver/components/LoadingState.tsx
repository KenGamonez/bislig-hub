export function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-block" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
