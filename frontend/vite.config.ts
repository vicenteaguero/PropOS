import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
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
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
          },
          {
            urlPattern: /\.(js|css|png|jpg|svg)$/,
            handler: "CacheFirst",
          },
        ],
      },
    }),
  ],
  server: {
    hmr: true,
    host: "0.0.0.0",
    port: 5173,
  },
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "./src/app"),
      "@core": path.resolve(__dirname, "./src/core"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
    },
  },
});
