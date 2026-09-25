interface DriverVehicleCardProps {
  vehicleType: string | null;
  vehicleModel: string | null;
  plateNumber: string | null;
  capacity: number | null;
  canAcceptPakyawan: boolean;
  canAcceptDeliveries: boolean;
}

export function DriverVehicleCard({
  vehicleType,
  vehicleModel,
  plateNumber,
  capacity,
  canAcceptPakyawan,
  canAcceptDeliveries,
}: DriverVehicleCardProps) {
  return (
    <div className="hub-driver__card hub-driver__vehicle">
      <p className="hub-driver__card-title">Vehicle & Services</p>
      <dl className="hub-driver__facts">
        <div>
          <dt>Type</dt>
          <dd>{vehicleType ?? "—"}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{vehicleModel ?? "—"}</dd>
        </div>
        <div>
          <dt>Plate</dt>
          <dd>{plateNumber ?? "—"}</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>{capacity != null ? `${capacity}` : "—"}</dd>
        </div>
      </dl>
      <div className="hub-driver__services">
        <dt>Enabled services</dt>
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