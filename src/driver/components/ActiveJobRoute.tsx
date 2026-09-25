export function ActiveJobRoute({
  pickup,
  destination,
}: {
  pickup: string;
  destination: string;
}) {
  return (
    <div className="hub-driver__route" aria-label="Trip route">
      <div className="hub-driver__route-stop">
        <span className="hub-driver__route-tag">Pickup</span>
        <strong className="hub-driver__route-place">{pickup}</strong>
      </div>
      <span className="hub-driver__route-line" aria-hidden="true" />
      <div className="hub-driver__route-stop">
        <span className="hub-driver__route-tag">Destination</span>
        <strong className="hub-driver__route-place">{destination}</strong>
      </div>
    </div>
  );
}
