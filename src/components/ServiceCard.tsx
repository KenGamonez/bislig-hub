import { Link } from "react-router-dom";

type ServiceCardProps = {
  title: string;
  description: string;
  to: string;
  accent?: boolean;
  icon: React.ReactNode;
  badge?: string;
};

export function ServiceCard({ title, description, to, accent, icon, badge }: ServiceCardProps) {
  return (
    <Link to={to} className={`service-card ${accent ? "service-card--accent" : ""}`}>
      <div className="service-card__icon-wrap" aria-hidden="true">
        {icon}
      </div>

      <div className="service-card__body">
        <div className="service-card__title-row">
          <h3 className="service-card__title">{title}</h3>
          {badge ? <span className="service-card__badge">{badge}</span> : null}
        </div>
        <p className="service-card__desc">{description}</p>
      </div>

      <span className="service-card__affordance" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
