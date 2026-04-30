import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const devPwa = process.env.VITE_DEV_PWA === "true";

export default defineConfig({
  envDir: "../",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      devOptions: { enabled: false },
      manifest: {
        name: "PropOS",
        short_name: "PropOS",
        display: "standalone",
        background_color: "#1C1816",
        theme_color: "#1C1816",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: devPwa
          ? [{ urlPattern: /.*/, handler: "NetworkOnly" }]
          : [
              { urlPattern: /\/api\/.*/, handler: "NetworkFirst" },
              { urlPattern: /\.(js|css|png|jpg|svg)$/, handler: "CacheFirst" },
            ],
        navigateFallback: devPwa ? null : undefined,
      },
    }),
  ],
  server: {
    hmr: { clientPort: devPwa ? 5443 : undefined },
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@core": path.resolve(__dirname, "./src/core"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
    },
  },
});
