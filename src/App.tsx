import { Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AppHeader } from "./components/AppHeader";
import { BottomNav } from "./components/BottomNav";
import { Home } from "./pages/Home";
import { Pakyawan } from "./pages/Pakyawan";
import { RideNow } from "./pages/RideNow";
import { History } from "./pages/History";

// Ported Bislig Ride screens (incl. maplibre + legacy stylesheet) are
// code-split so the Hub home stays light on mobile networks.
const Delivery = lazy(() =>
  import("./pages/Delivery").then((m) => ({ default: m.Delivery }))
);
const BecomeDriver = lazy(() =>
  import("./pages/BecomeDriver").then((m) => ({ default: m.BecomeDriver }))
);
const Driver = lazy(() =>
  import("./pages/Driver").then((m) => ({ default: m.Driver }))
);
const DriverReset = lazy(() =>
  import("./pages/DriverReset").then((m) => ({ default: m.DriverReset }))
);
const Admin = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.Admin }))
);

function LegacyFallback() {
  return (
    <div className="container">
      <div className="loading-block" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    </div>
  );
}

/**
 * Ported Bislig Ride screens bring their own (Hub-branded) header, so the
 * Hub header + bottom nav are hidden on those routes to avoid doubled chrome.
 */
const LEGACY_PREFIXES = ["/delivery", "/become-a-driver", "/driver", "/admin"];

function isLegacyRoute(pathname: string): boolean {
  return LEGACY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function App() {
  const location = useLocation();
  const legacy = isLegacyRoute(location.pathname);

  if (legacy) {
    return (
      <div className="app-shell">
        <div className="app-canvas">
          <main id="main-content">
            <Suspense fallback={<LegacyFallback />}>
              <Routes>
                <Route path="/delivery" element={<Delivery />} />
                <Route path="/become-a-driver" element={<BecomeDriver />} />
                <Route path="/driver" element={<Driver />} />
                <Route path="/driver/reset-password" element={<DriverReset />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-canvas">
        <AppHeader />
        <main className="page" id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ride" element={<RideNow />} />
            <Route path="/pakyawan" element={<Pakyawan />} />
            <Route path="/history" element={<History />} />
            <Route
              path="*"
              element={
                <div className="container" style={{ paddingTop: 32 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700 }}>Page not found</h1>
                  <p style={{ color: "var(--text-muted)", marginTop: 8 }}>The page you’re looking for doesn’t exist yet.</p>
                  <a href="/" className="btn btn--primary" style={{ marginTop: 16, display: "inline-flex" }}>
                    Go home
                  </a>
                </div>
              }
            />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
