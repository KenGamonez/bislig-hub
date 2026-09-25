import { Link } from "react-router-dom";
import { SectionHeader } from "../components/SectionHeader";
import { ComingSoonCard, ServiceCard } from "../components/ServiceCard";

function RideIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 14a2 2 0 1 0 0.01 0A2 2 0 0 0 6 14ZM18 14a2 2 0 1 0 0.01 0A2 2 0 0 0 18 14Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 14H4.2a1.2 1.2 0 0 1-1.2-1.2V9.2A2 2 0 0 1 5 7.2h10.2L17.8 10a1.1 1.1 0 0 1 .2.6V12.8a1.2 1.2 0 0 1-1.2 1.2H18" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 9.2V8a1 1 0 0 1 1-1h3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PakyawanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="7.5" width="11" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14.5 10.5h3.2a1.3 1.3 0 0 1 1.3 1.3v2.4a1.3 1.3 0 0 1-1.3 1.3h-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7 16.5a1.6 1.6 0 1 0 0.01 0M17 16.5a1.6 1.6 0 1 0 0.01 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 11.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

function DeliveryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 9a1.5 1.5 0 0 1 1.5-1.5H11l2.2 2.2A1.5 1.5 0 0 0 14.3 10H16a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3.5 15V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 7.5V6a1 1 0 0 1 1-1h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 13.5V11a2 2 0 0 1 2-2h9l2.2 2.2A2 2 0 0 1 18 12.8V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="7" cy="15.8" r="1.7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="15.8" r="1.7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9V7.2a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ServicesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Home() {
  return (
    <div className="home">
      {/* Hero */}
      <div className="container">
        <section className="hero" aria-labelledby="home-title">
          <p className="hero__eyebrow">Your city. Connected.</p>
          <h1 id="home-title" className="hero__title">
            What do you need today?
          </h1>
          <p className="hero__subtitle">Choose a service to get started — fast, local, and reliable.</p>
        </section>

        {/* Transport */}
        <section className="stack" aria-labelledby="transport-heading">
          <SectionHeader title="Transport" subtitle="Available now in Bislig City" kicker="Move around the city" />

          <div className="card-grid" id="transport-heading">
            <ServiceCard
              title="Ride Now"
              description="Get a ride around Bislig — quick pickup, fair fare."
              to="/ride"
              accent
              badge="Fastest"
              icon={<RideIcon />}
            />
            <ServiceCard
              title="Pakyawan"
              description="Book a vehicle for longer trips or private use."
              to="/pakyawan"
              icon={<PakyawanIcon />}
            />
            <ServiceCard
              title="Delivery"
              description="Send food & parcels across Bislig City."
              to="/delivery"
              icon={<DeliveryIcon />}
            />
          </div>
        </section>

        {/* Coming Soon */}
        <section className="stack stack--muted" aria-labelledby="soon-heading">
          <SectionHeader title="Coming Soon" subtitle="More local services on the way" kicker="Next up" />
          <div className="card-grid card-grid--soon" id="soon-heading">
            <ComingSoonCard title="Car Rental" description="Self-drive rentals via GoDrive." icon={<CarIcon />} />
            <ComingSoonCard title="Services" description="Local businesses and everyday services." icon={<ServicesIcon />} />
          </div>
          <p className="soon-note">Car Rental and Services are preview items only — they will launch when ready.</p>
        </section>

        {/* Driver entry */}
        <section className="stack stack--muted" aria-labelledby="drive-heading">
          <SectionHeader title="Drive with Hub" subtitle="Earn on your own schedule" kicker="For drivers" />
          <div className="card-grid" id="drive-heading">
            <ServiceCard
              title="Become a driver"
              description="Apply once, drive for rides, pakyawan & delivery."
              to="/become-a-driver"
              icon={<RideIcon />}
            />
            <ServiceCard
              title="Driver login"
              description="Already driving? Open your dashboard."
              to="/driver"
              icon={<PakyawanIcon />}
            />
          </div>
        </section>

        <footer className="home-foot">
          <p className="home-foot__text">
            Bislig Hub is the consumer platform for the city. Rides, pakyawan
            and delivery run on one shared operations backend.
          </p>
          <p className="home-foot__text">
            <Link to="/admin" className="home-foot__admin">
              Admin
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
