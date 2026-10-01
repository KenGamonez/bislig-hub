import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { DriverExperience } from "../legacy/pages/DriverExperience";
import { DriverLogin } from "../legacy/components/DriverLogin";
import { supabase } from "../legacy/lib/supabase";
import { LegacyShell, useLegacyViewChange } from "../components/LegacyShell";
import "../driver/driver-login.css";

/**
 * Driver entry — replicates the Bislig Ride App gating (read-only logic):
 * session -> drivers row -> login | blocked | dashboard.
 */
export function Driver() {
  const onViewChange = useLegacyViewChange();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session?.user) {
        setDriverId(null);
        setBlocked(false);
        setMustChangePassword(false);
        setChecking(false);
        return;
      }

      // Full select includes the first-login flag. If the BTRP
      // mini-system migration has not been applied yet, fall back to the
      // core columns so the legacy entry keeps working.
      const fullSelect = await supabase
        .from("drivers")
        .select("id, status, must_change_password")
        .eq("auth_user_id", data.session.user.id)
        .maybeSingle();

      let driver: {
        id: string;
        status: string;
        must_change_password?: boolean;
      } | null = fullSelect.data as {
        id: string;
        status: string;
        must_change_password?: boolean;
      } | null;

      if (fullSelect.error) {
        const coreSelect = await supabase
          .from("drivers")
          .select("id, status")
          .eq("auth_user_id", data.session.user.id)
          .maybeSingle();
        driver = coreSelect.data as {
          id: string;
          status: string;
        } | null;
      }

      if (!mounted) return;

      if (driver && driver.status === "inactive") {
        setDriverId(null);
        setBlocked(true);
      } else {
        setDriverId(driver ? (driver.id as string) : null);
        setBlocked(false);
        setMustChangePassword(Boolean(driver?.must_change_password));
      }
      setChecking(false);
    };

    void check();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (mounted) {
        setChecking(true);
        void check();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <LegacyShell tone="driver">
        <div className="container">
          <div className="loading-block" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Checking driver session…</p>
          </div>
        </div>
      </LegacyShell>
    );
  }

  if (blocked) {
    return (
      <LegacyShell tone="driver">
        <div className="container">
          <div className="notice-card" role="alert">
            <h1 className="notice-card__title">Driver access paused</h1>
            <p className="notice-card__text">
              Your driver account is inactive. Please contact Bislig Hub to
              reactivate it.
            </p>
            <Link to="/" className="btn btn--primary">
              Back to Home
            </Link>
          </div>
        </div>
      </LegacyShell>
    );
  }

  if (!driverId) {
    return (
      <div className="hub-driver-login">
        <div className="hub-driver-login__brand">
          <img
            src="/assets/btrp-toda-logo.png"
            alt="BTRP TODA official seal"
            className="hub-driver-login__seal"
            width={144}
            height={144}
            decoding="async"
          />
          <p className="hub-driver-login__eyebrow">
            BTRP TODA · Driver access
          </p>
          <p className="hub-driver-login__tag">
            One account for work, news, and the shared TODA chat.
          </p>
        </div>
        <LegacyShell tone="driver">
          <DriverLogin
            onLogin={(id) => setDriverId(id)}
            onBack={() => onViewChange("Rider")}
          />
        </LegacyShell>
      </div>
    );
  }

  // First-login gate: provisioned drivers replace the temporary password
  // before entering either workspace.
  if (mustChangePassword) {
    return <Navigate to="/driver/welcome" replace />;
  }

  return (
    <LegacyShell tone="driver">
      <DriverExperience onBack={() => onViewChange("Rider")} />
    </LegacyShell>
  );
}

