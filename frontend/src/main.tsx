import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/archivo";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { App } from "@app/app";
import { requestUpdate } from "@core/version/version";
import { bootstrapPalette } from "@core/theme/palette";
import { bootstrapTheme } from "@core/theme/theme";
import "./index.css";

// Apply persisted theme (light/dark) + palette before first paint
bootstrapTheme();
bootstrapPalette();

const UPDATE_INTERVAL_MS = 60 * 1000;

registerSW({
  onNeedRefresh() {
    // The gate owns the overlay and the reload. The old `confirm()` here let the
    // user answer "no" and keep running a bundle the server had already replaced.
    requestUpdate();
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
