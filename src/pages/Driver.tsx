import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DriverExperience } from "../legacy/pages/DriverExperience";
import { DriverLogin } from "../legacy/components/DriverLogin";
import { supabase } from "../legacy/lib/supabase";
import { LegacyShell, useLegacyViewChange } from "../components/LegacyShell";

/**
 * Driver entry — replicates the Bislig Ride App gating (read-only logic):
 * session -> drivers row -> login | blocked | dashboard.
 */
export function Driver() {
  const onViewChange = useLegacyViewChange();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session?.user) {
        setDriverId(null);
        setBlocked(false);
        setChecking(false);
        return;
      }

      const { data: driver } = await supabase
        .from("drivers")
        .select("id, status")
        .eq("auth_user_id", data.session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (driver && driver.status === "inactive") {
        setDriverId(null);
        setBlocked(true);
      } else {
        setDriverId(driver ? (driver.id as string) : null);
        setBlocked(false);
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
      <LegacyShell>
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
      <LegacyShell>
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
      <LegacyShell>
        <DriverLogin
          view="driver"
          onViewChange={onViewChange}
          onLogin={(id) => setDriverId(id)}
          onBack={() => onViewChange("Rider")}
        />
      </LegacyShell>
    );
  }

  return (
    <LegacyShell>
      <DriverExperience
        view="driver"
        onViewChange={onViewChange}
        onBack={() => onViewChange("Rider")}
      />
    </LegacyShell>
  );
}
