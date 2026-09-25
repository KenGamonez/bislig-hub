import { SectionHeader } from "../components/SectionHeader";
import { ServiceCard } from "../components/ServiceCard";
import { useLanguage } from "../legacy/lib/i18n";

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

export function Home() {
  const { t } = useLanguage();
  return (
    <div className="home">
      {/* Hero */}
      <div className="container">
        <section className="hero" aria-labelledby="home-title">
          <p className="hero__eyebrow">{t("hub.tagline")}</p>
          <h1 id="home-title" className="hero__title">
            {t("dash.title1")} {t("dash.title2")}
          </h1>
          <p className="hero__subtitle">{t("hub.subtitle")}</p>
        </section>

        {/* Transport */}
        <section className="stack" aria-labelledby="transport-heading">
          <SectionHeader
            title={t("hub.transportTitle")}
            subtitle={t("hub.transportSubtitle")}
            kicker={t("hub.transportKicker")}
          />

          <div className="card-grid" id="transport-heading">
            <ServiceCard
              title={t("dash.rideNow")}
              description={t("hub.rideNowDesc")}
              to="/ride"
              accent
              badge="Fastest"
              icon={<RideIcon />}
            />
            <ServiceCard
              title={t("dash.pakyawan")}
              description={t("hub.pakyawanDesc")}
              to="/pakyawan"
              icon={<PakyawanIcon />}
            />
            <ServiceCard
              title={t("hub.deliveryTitle")}
              description={t("hub.deliveryDesc")}
              to="/delivery"
              icon={<DeliveryIcon />}
            />
          </div>
        </section>

        {/* Driver entry */}
        <section className="stack stack--muted" aria-labelledby="drive-heading">
          <SectionHeader
            title={t("hub.driveTitle")}
            subtitle={t("hub.driveSubtitle")}
            kicker={t("hub.driveKicker")}
          />
          <div className="card-grid" id="drive-heading">
            <ServiceCard
              title={t("nav.becomeDriver")}
              description={t("hub.becomeDesc")}
              to="/become-a-driver"
              icon={<RideIcon />}
            />
            <ServiceCard
              title={t("nav.driverLogin")}
              description={t("hub.driverLoginDesc")}
              to="/driver"
              icon={<PakyawanIcon />}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
