export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "active" | "success" | "warn";
  children: React.ReactNode;
}) {
  return (
    <span className={`hub-driver__pill hub-driver__pill--${tone}`}>
      {children}
    </span>
  );
}
