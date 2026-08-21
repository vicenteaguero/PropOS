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

/**
 * Which vendor chunk each package belongs to, keyed by package root.
 *
 * This used to be the object form of `manualChunks`, and that form is a trap:
 * Rollup assigns a named group the whole dependency SUBTREE of the packages it
 * lists, so a tiny utility that several packages share lands inside whichever
 * heavy group happened to claim it first. That is exactly what happened —
 * `clsx` (needed by `cn()`, i.e. by every component in the app) ended up inside
 * `vendor-pdf`, and `use-sync-external-store` (pulled in by a Radix primitive)
 * inside `vendor-charts`. The entry chunk therefore imported both heavy vendors
 * STATICALLY, for one 2 kB helper each:
 *
 *     import{c as Lb}from"./vendor-pdf-*.js";      // clsx — 894 kB
 *     import{r as OE}from"./vendor-charts-*.js";   // use-sync-external-store — 383 kB
 *
 * So 1.28 MB of pdf-lib and recharts downloaded AND executed before first
 * paint, on every visit, and Vite's `modulepreload` links in index.html were
 * simply reporting that honestly. Keeping those packages out of the service
 * worker precache (see `globIgnores` below) did nothing about it.
 *
 * The function form fixes the class of bug, not just today's instance: it
 * matches on the package root only, so a shared dependency that nothing here
 * names explicitly falls through to `undefined` and Rollup gives it its own
 * automatically-split chunk instead of smuggling it into a heavy one.
 *
 * The small shared utilities below are listed under `vendor-react` on purpose:
 * they are a few kB, the shell needs them to render anything at all, and
 * naming them is what stops them from being absorbed again.
 */
const VENDOR_GROUPS: Record<string, string[]> = {
  "vendor-react": [
    "react",
    "react-dom",
    "react-router-dom",
    "@tanstack/react-query",
    "@tanstack/react-virtual",
    "clsx",
    "tailwind-merge",
    "class-variance-authority",
    "use-sync-external-store",
  ],
  "vendor-supabase": ["@supabase/supabase-js"],
  "vendor-pdf": ["pdf-lib", "react-pdf", "pdfjs-dist"],
  "vendor-charts": ["recharts"],
  "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  // Deliberately smaller than it was. `mammoth` (DOCX → HTML), `file-type` and
  // `browser-image-compression` each serve one screen, but sat in the same
  // group as `lucide-react`, which the layout imports on every page — so they
  // rode along on every load. Unlisted, they get their own chunks and load when
  // the screen that needs them does.
  "vendor-misc": ["qrcode.react", "idb", "sonner", "lucide-react"],
};

const PACKAGE_TO_CHUNK = new Map<string, string>(
  Object.entries(VENDOR_GROUPS).flatMap(([chunk, packages]) => packages.map((p) => [p, chunk])),
);

function manualChunks(id: string): string | undefined {
  const parts = id.split("node_modules/");
  if (parts.length < 2) return undefined;
  const after = parts[parts.length - 1];
  const segments = after.split("/");
  const pkg = after.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
  return PACKAGE_TO_CHUNK.get(pkg);
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
          "assets/heic2any-*.js", // HEIC decode, iOS photo upload only
          "assets/vendor-pdf-*.js", // pdf-lib + react-pdf, document viewer only
          "assets/vendor-charts-*.js", // recharts, analytics pages only
          "assets/property-map-*.js", // maplibre-gl, properties map view only
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
    // 5443 is the HTTPS proxy `make dev-pwa-hmr` puts in front of vite. Running
    // vite on its own left the HMR client dialling a port nothing was on, and
    // the failed socket made the page reload on a loop.
    hmr: { clientPort: Number(process.env.VITE_HMR_CLIENT_PORT ?? 5443) },
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
        manualChunks,
      },
    },
  },
});
