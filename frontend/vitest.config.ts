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
    // Pin the clock's zone.
    //
    // The date formatters are asserted against UTC strings ("09:30Z" -> 09:30),
    // which only holds when the runner is in UTC. On a machine in Chile
    // (UTC-4) those two suites had been failing locally while CI stayed green,
    // so the tests were quietly untrustworthy in exactly the place they get
    // read most: on the developer's laptop.
    env: { TZ: "UTC" },
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
