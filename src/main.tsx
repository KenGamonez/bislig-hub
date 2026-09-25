import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { LanguageProvider } from "./legacy/lib/i18n";
import "./styles/globals.css";
import "./styles/components.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);

// Minimal service-worker registration for installability only (see public/sw.js).
// Network-only worker: no caching, no impact on realtime/auth/dispatch.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability enhancement only — the app works fully without it.
    });
  });
}
