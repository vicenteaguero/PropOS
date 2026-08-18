import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // jsdom, not node: component tests need a DOM. Pure util tests run fine
    // under it too, so one environment covers both.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // `.tsx` matters. The glob used to be `*.test.ts` only, so a component test
    // written with React's natural extension was never collected — and CI
    // passed `--passWithNoTests`, which turned "collected nothing" into green.
    include: ["src/**/*.test.{ts,tsx}"],
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
