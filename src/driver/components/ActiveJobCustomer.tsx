export function ActiveJobCustomer({
  name,
  phone,
}: {
  name: string;
  phone: string;
}) {
  const digits = phone.replace(/[^\d+]/g, "");
  return (
    <div className="hub-driver__customer">
      <div className="hub-driver__customer-id">
        <span
          className="hub-driver__customer-avatar"
          aria-hidden="true"
        >
          {(name.trim().charAt(0) || "?").toUpperCase()}
        </span>
        <div>
          <p className="hub-driver__card-title">{name}</p>
          <p className="hub-driver__card-sub">Passenger</p>
        </div>
      </div>
      {digits ? (
        <a
          className="btn btn--ghost btn--compact"
          href={`tel:${digits}`}
          aria-label={`Call ${name}`}
        >
          Call
        </a>
      ) : null}
    </div>
  );
}
