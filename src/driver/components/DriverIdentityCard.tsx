interface DriverIdentityCardProps {
  name: string;
  vehicle: string;
  plateNumber: string | null;
  capacity: number | null;
  rating: number | null;
  status: string;
  username: string | null;
  email: string | null;
  canAcceptPakyawan: boolean;
  canAcceptDeliveries: boolean;
  online: boolean;
}

export function DriverIdentityCard({
  name,
  vehicle,
  plateNumber,
  capacity,
  rating,
  status,
  username,
  email,
  canAcceptPakyawan,
  canAcceptDeliveries,
  online,
}: DriverIdentityCardProps) {
  const statusLabel = status === "active" ? "Active" : status.charAt(0).toUpperCase() + status.slice(1);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="hub-driver__card hub-driver__identity">
      <div className="hub-driver__identity-top">
        <div className="hub-driver__avatar" aria-hidden="true">
          {initial}
        </div>
        <div className="hub-driver__identity-copy">
          <p className="hub-driver__identity-name">{name}</p>
          <p className="hub-driver__identity-meta">
            {vehicle}
            {plateNumber ? ` · ${plateNumber}` : ""}
          </p>
          <p className="hub-driver__identity-signed">
            {username ? (
              <>Signed in as <strong>{username}</strong></>
            ) : email ? (
              <>Signed in as <strong>{email}</strong></>
            ) : null}
          </p>
        </div>
      </div>

      <dl className="hub-driver__facts hub-driver__identity-facts">
        <div>
          <dt>Capacity</dt>
          <dd>{capacity != null ? `${capacity}` : "—"}</dd>
        </div>
        <div>
          <dt>Rating</dt>
          <dd>{rating != null ? Number(rating).toFixed(1) : "New"}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>
            <span className={`hub-driver__pill${status === "active" ? " hub-driver__pill--success" : ""}`}>
              {statusLabel}
            </span>
          </dd>
        </div>
        <div>
          <dt>Online</dt>
          <dd>
            <span className={`hub-driver__pill${online ? " hub-driver__pill--success" : ""}`}>
              {online ? "Online" : "Offline"}
            </span>
          </dd>
        </div>
      </dl>

      <div className="hub-driver__services">
        <dt>Services</dt>
        <dd className="hub-driver__service-row">
          <span className={`hub-driver__service-badge${canAcceptPakyawan ? " is-enabled" : ""}`}>
            Pakyawan
          </span>
          <span className={`hub-driver__service-badge${canAcceptDeliveries ? " is-enabled" : ""}`}>
            Delivery
          </span>
        </dd>
      </div>
    </div>
  );
}