import { defineConfig, type Plugin } from "vite";
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

/**
 * Identifies the build for the update gate, so it has to be stable and unique per
 * deploy. `git describe` is the good answer locally but returns "dev" on Vercel,
 * whose shallow clone carries no tags — and a constant "dev" would make every
 * client agree with every build and silently disable the gate. The commit SHA
 * Vercel exports is the fallback.
 */
function buildVersion(): string {
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION;
  const described = gitVersion();
  if (described !== "dev") return described;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 12) : "dev";
}

const APP_VERSION = buildVersion();

/**
 * Publishes the built commit at a fixed URL so a running tab can tell whether it
 * is still current. Deliberately NOT part of the precache (see `globPatterns`,
 * which lists no `.json`) — a precached manifest would answer with the very
 * build it is supposed to detect as stale.
 */
function versionManifest(): Plugin {
  return {
    name: "propos:version-manifest",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: APP_VERSION }),
      });
    },
  };
}

export default defineConfig({
  envDir: "../",
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION),
  },
  plugins: [
    versionManifest(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: devPwa },
      manifest: {
        // `id` pins the app identity across start_url changes — without it a
        // later start_url edit registers as a DIFFERENT app and users end up
        // with two icons on the home screen.
        id: "/",
        name: "PropOS",
        short_name: "PropOS",
        description: "Plataforma de operaciones inmobiliarias multi-tenant.",
        lang: "es-CL",
        dir: "ltr",
        display: "standalone",
        // Deliberately no `orientation` lock: the installed app has to work in
        // iPad landscape, where it gets the full sidebar + master-detail layout.
        scope: "/",
        categories: ["business", "productivity"],
        // Splash colors follow the app's dark default; the live status bar is
        // re-pointed per theme at runtime (see core/theme/theme.ts).
        background_color: "#000000",
        theme_color: "#000000",
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
        // Layer custom web-push handlers onto the generated worker. The file
        // lives in public/ so it ships to the dist root at /push-sw.js.
        importScripts: ["push-sw.js"],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2,mjs}"],
        // Precache is an eager download on first load, so it cancels out code
        // splitting: a lazily-imported chunk listed here ships to every user
        // regardless. Keep the heavy, route-specific bundles out — the
        // CacheFirst runtimeCaching rule below still caches them permanently
        // on first real use, so offline access survives after one visit.
        globIgnores: [
          "logo.png",
          "assets/heic2any-*.js", // HEIC decode, iOS photo upload only
          "assets/vendor-pdf-*.js", // pdf-lib + react-pdf, document viewer only
          "assets/vendor-charts-*.js", // recharts, analytics pages only
          "pdfjs/**", // worker already has its own CacheFirst rule
        ],
        runtimeCaching: devPwa
          ? [{ urlPattern: /.*/, handler: "NetworkOnly" }]
          : [
              // Must be first: this is the staleness probe, so a cached answer
              // defeats the whole mechanism.
              { urlPattern: /\/version\.json/, handler: "NetworkOnly" },
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
          "vendor-charts": ["recharts"],
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
