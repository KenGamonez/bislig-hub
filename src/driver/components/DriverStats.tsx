interface DriverStatsProps {
  completedRides: number;
  averageStars: number;
  totalRatings: number;
  cancelledRides: number;
  cancellationRate: number;
}

export function DriverStats({
  completedRides,
  averageStars,
  totalRatings,
  cancelledRides,
  cancellationRate,
}: DriverStatsProps) {
  return (
    <div className="hub-driver__card hub-driver__stats">
      <div className="hub-driver__stat-tile">
        <span className="hub-driver__stat-label">Completed rides</span>
        <strong className="hub-driver__stat-value">{completedRides}</strong>
        <small>All-time trips</small>
      </div>
      <div className="hub-driver__stat-tile">
        <span className="hub-driver__stat-label">Rating</span>
        <strong className="hub-driver__stat-value">{averageStars.toFixed(1)}</strong>
        <small>{totalRatings} rating{totalRatings === 1 ? "" : "s"}</small>
      </div>
      <div className="hub-driver__stat-tile">
        <span className="hub-driver__stat-label">Cancellations</span>
        <strong className="hub-driver__stat-value">
          {cancelledRides} ({cancellationRate}%)
        </strong>
        <small>Of all completed rides</small>
      </div>
    </div>
  );
}