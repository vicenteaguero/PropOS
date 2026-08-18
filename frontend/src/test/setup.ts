// Vitest setup, loaded before every test file (see vitest.config.ts).
//
// Registers the jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, …)
// and unmounts anything a test rendered. React Testing Library only auto-cleans
// when Vitest globals are on; this project imports `describe`/`it`/`expect`
// explicitly, so cleanup is wired by hand instead.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
