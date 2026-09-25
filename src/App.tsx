import { Routes, Route } from "react-router-dom";
import { AppHeader } from "./components/AppHeader";
import { BottomNav } from "./components/BottomNav";
import { Home } from "./pages/Home";
import { Pakyawan } from "./pages/Pakyawan";
import { RideNow } from "./pages/RideNow";

export default function App() {
  return (
    <div className="app-shell">
      <div className="app-canvas">
        <AppHeader />
        <main className="page" id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ride" element={<RideNow />} />
            <Route path="/pakyawan" element={<Pakyawan />} />
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
