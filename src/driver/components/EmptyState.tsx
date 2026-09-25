export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="hub-driver__empty">
      <p className="hub-driver__empty-title">{title}</p>
      <p className="hub-driver__empty-body">{body}</p>
      {action}
    </div>
  );
}
