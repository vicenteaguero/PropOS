import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import path from "path";

const devPwa = process.env.VITE_DEV_PWA === "true";

function gitVersion(): string {
  try {
    return execSync("git describe --tags --always --dirty", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const APP_VERSION = process.env.VITE_APP_VERSION ?? gitVersion();

export default defineConfig({
  envDir: "../",
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      devOptions: { enabled: devPwa },
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
        shortcuts: [
          {
            name: "Agente",
            short_name: "Agente",
            url: "/admin/agent",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Documentos",
            short_name: "Docs",
            url: "/admin/documents",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Inbox",
            short_name: "Inbox",
            url: "/admin/client-inbox",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2,mjs}"],
        globIgnores: ["logo.png"],
        runtimeCaching: devPwa
          ? [{ urlPattern: /.*/, handler: "NetworkOnly" }]
          : [
              { urlPattern: /\/api\/.*/, handler: "NetworkFirst" },
              {
                urlPattern: /\/storage\/v1\/object\/sign\/documents\//,
                handler: "StaleWhileRevalidate",
                options: {
                  cacheName: "documents-signed",
                  // 7 days; pinned-offline docs prefetch into this cache and
                  // remain available for the full window.
                  expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /\/pdfjs\/.*/,
                handler: "CacheFirst",
                options: {
                  cacheName: "pdfjs-runtime",
                  expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              { urlPattern: /\.(js|css|png|jpg|svg|mjs)$/, handler: "CacheFirst" },
            ],
        navigateFallback: devPwa ? null : undefined,
      },
    }),
  ],
  server: {
    hmr: { clientPort: 5443 },
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/health": {
        target: process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
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
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": [
            "react",
            "react-dom",
            "react-router-dom",
            "@tanstack/react-query",
            "@tanstack/react-virtual",
          ],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-pdf": ["pdf-lib", "react-pdf", "pdfjs-dist"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          "vendor-misc": [
            "browser-image-compression",
            "qrcode.react",
            "file-type",
            "mammoth",
            "idb",
            "sonner",
            "lucide-react",
          ],
        },
      },
    },
  },
});
