import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "@app/app";
import "./index.css";

const UPDATE_INTERVAL_MS = 60 * 1000; // check every 60s

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nueva versión disponible. ¿Actualizar ahora?")) {
      updateSW(true);
    }
  },
  onRegisteredSW(_url, registration) {
    // Periodically check for SW updates — iOS doesn't do this on its own
    if (registration) {
      setInterval(() => {
        registration.update();
      }, UPDATE_INTERVAL_MS);
    }
  },
});

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
