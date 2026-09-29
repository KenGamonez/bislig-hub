import { Suspense, lazy } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AppHeader } from "./components/AppHeader";
import { BottomNav } from "./components/BottomNav";
import { Home } from "./pages/Home";
import { Pakyawan } from "./pages/Pakyawan";
import { RideNow } from "./pages/RideNow";
import { History } from "./pages/History";
import { DriverPresenceProvider } from "./driver/hooks/useDriverPresenceContext";

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

// Organization admin area (read-only group dashboard; separate shell).
const OrgLogin = lazy(() =>
  import("./org/pages/OrgLogin").then((m) => ({ default: m.OrgLogin }))
);
const OrgDashboard = lazy(() =>
  import("./org/pages/OrgDashboard").then((m) => ({ default: m.OrgDashboard }))
);
const OrgDrivers = lazy(() =>
  import("./org/pages/OrgDrivers").then((m) => ({ default: m.OrgDrivers }))
);
const OrgActivity = lazy(() =>
  import("./org/pages/OrgActivity").then((m) => ({ default: m.OrgActivity }))
);
const OrgAnnouncements = lazy(() =>
  import("./org/pages/OrgAnnouncements").then((m) => ({
    default: m.OrgAnnouncements,
  }))
);
const OrgForum = lazy(() =>
  import("./org/pages/OrgForum").then((m) => ({ default: m.OrgForum }))
);
const OrgTopic = lazy(() =>
  import("./org/pages/OrgTopic").then((m) => ({ default: m.OrgTopic }))
);
const OrgShell = lazy(() =>
  import("./org/OrgShell").then((m) => ({ default: m.OrgShell }))
);
const OrgSettings = lazy(() =>
  import("./org/pages/OrgSettings").then((m) => ({ default: m.OrgSettings }))
);

// New Hub-native driver UI (Phase 6D; runs alongside the legacy workspace).
const DriverJobs = lazy(() =>
  import("./driver/pages/JobsPage").then((m) => ({ default: m.JobsPage }))
);
const DriverActive = lazy(() =>
  import("./driver/pages/ActiveJobPage").then((m) => ({
    default: m.ActiveJobPage,
  }))
);
const DriverYou = lazy(() =>
  import("./driver/pages/YouPage").then((m) => ({ default: m.YouPage }))
);
const DriverHistory = lazy(() =>
  import("./driver/pages/DriverHistoryPage").then((m) => ({
    default: m.DriverHistoryPage,
  }))
);
const DriverShell = lazy(() =>
  import("./driver/DriverShell").then((m) => ({ default: m.DriverShell }))
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
 * Ported screens render Hub chrome instead of the legacy Ride header:
 * - public legacy pages (/delivery, /become-a-driver): Hub header + bottom nav
 * - driver workspace (/driver, /driver/reset-password): Hub header only
 *   (the dashboard keeps its own internal navigation)
 * - /admin: untouched legacy shell (separate controlled phase)
 */
const PUBLIC_LEGACY_PREFIXES = ["/delivery", "/become-a-driver"];
const DRIVER_PREFIXES = ["/driver/reset-password"];
const NEW_DRIVER_PREFIXES = ["/driver", "/driver/jobs", "/driver/active", "/driver/you", "/driver/history"];
const ADMIN_PREFIXES = ["/admin"];
const ORG_PREFIXES = ["/org"];

function matchPrefixes(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function App() {
  const location = useLocation();
  const isPublicLegacy = matchPrefixes(location.pathname, PUBLIC_LEGACY_PREFIXES);
  const isDriverRoute = matchPrefixes(location.pathname, DRIVER_PREFIXES);
  const isNewDriverRoute = matchPrefixes(location.pathname, NEW_DRIVER_PREFIXES);
  const isAdminRoute = matchPrefixes(location.pathname, ADMIN_PREFIXES);
  const isOrgRoute = matchPrefixes(location.pathname, ORG_PREFIXES);

  // Public driver sign-in has its own screen and must be matched before
  // the workspace prefix check below ("/driver/login" starts with "/driver").
  if (location.pathname === "/driver/login") {
    return (
      <div className="app-shell">
        <div className="app-canvas">
          <main id="main-content">
            <Suspense fallback={<LegacyFallback />}>
              <Routes>
                <Route path="/driver/login" element={<Driver />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    );
  }

  // New Hub-native driver UI has its own shell/chrome.
  // NOTE: check before isDriverRoute since these paths share the prefix.
  if (isNewDriverRoute) {
    return (
      <div className="app-shell">
        <div className="app-canvas">
          <Suspense fallback={<LegacyFallback />}>
            <DriverPresenceProvider>
              <DriverShell>
                <Routes>
                  <Route path="/driver" element={<Navigate to="/driver/jobs" replace />} />
                  <Route path="/driver/jobs" element={<DriverJobs />} />
                  <Route path="/driver/active" element={<DriverActive />} />
                  <Route path="/driver/you" element={<DriverYou />} />
                  <Route path="/driver/history" element={<DriverHistory />} />
                </Routes>
              </DriverShell>
            </DriverPresenceProvider>
          </Suspense>
        </div>
      </div>
    );
  }

  if (isAdminRoute) {
    return (
      <div className="app-shell">
        <div className="app-canvas">
          <main id="main-content">
            <Suspense fallback={<LegacyFallback />}>
              <Routes>
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    );
  }

  // Organization admin area: own shell/chrome, guarded per page by the
  // organization_admins lookup (never by URL alone).
  if (isOrgRoute) {
    return (
      <div className="app-shell">
        <div className="app-canvas">
          <Suspense fallback={<LegacyFallback />}>
            <Routes>
              <Route path="/org/login" element={<OrgLogin />} />
              <Route path="/org" element={<Navigate to="/org/login" replace />} />
              <Route
                path="/org/:slug/dashboard"
                element={
                  <OrgShell>
                    <OrgDashboard />
                  </OrgShell>
                }
              />
              <Route
                path="/org/:slug/drivers"
                element={
                  <OrgShell>
                    <OrgDrivers />
                  </OrgShell>
                }
              />
              <Route
                path="/org/:slug/activity"
                element={
                  <OrgShell>
                    <OrgActivity />
                  </OrgShell>
                }
              />
              <Route
                path="/org/:slug/announcements"
                element={
                  <OrgShell>
                    <OrgAnnouncements />
                  </OrgShell>
                }
              />
              <Route
                path="/org/:slug/forum"
                element={
                  <OrgShell>
                    <OrgForum />
                  </OrgShell>
                }
              />
              <Route
                path="/org/:slug/settings"
                element={
                  <OrgShell>
                    <OrgSettings />
                  </OrgShell>
                }
              />
              <Route
                path="/org/:slug/forum/:topicId"
                element={
                  <OrgShell>
                    <OrgTopic />
                  </OrgShell>
                }
              />
            </Routes>
          </Suspense>
        </div>
      </div>
    );
  }

  if (isPublicLegacy || isDriverRoute) {
    return (
      <div className="app-shell">
        <div className="app-canvas">
          <AppHeader />
          <main className="page" id="main-content">
            <Suspense fallback={<LegacyFallback />}>
              <Routes>
                <Route path="/delivery" element={<Delivery />} />
                <Route path="/become-a-driver" element={<BecomeDriver />} />
                <Route path="/driver" element={<Driver />} />
                <Route path="/driver/reset-password" element={<DriverReset />} />
              </Routes>
            </Suspense>
          </main>
          {isPublicLegacy && <BottomNav />}
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
