import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "@app/app";
import "./index.css";

// Prompt user to reload when a new service worker is available
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nueva versión disponible. ¿Actualizar ahora?")) {
      updateSW(true);
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
