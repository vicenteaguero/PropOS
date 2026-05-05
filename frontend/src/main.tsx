import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "@app/app";
import { bootstrapPalette } from "@core/theme/palette";
import "./index.css";

// Apply persisted theme palette before first paint
bootstrapPalette();

const UPDATE_INTERVAL_MS = 60 * 1000;

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nueva versión disponible. ¿Actualizar ahora?")) {
      updateSW(true);
    }
  },
  onRegisteredSW(_url, registration) {
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
