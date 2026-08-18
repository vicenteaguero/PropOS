// Smoke test for the test harness itself, not for any product component.
//
// It fails if any of the four pieces regress: `.test.tsx` collection (the old
// `include` glob silently skipped this extension), the jsdom environment, React
// Testing Library rendering, and the jest-dom matchers registered in setup.ts.
// Delete it once real component tests cover the same ground.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("collects .test.tsx files and renders into jsdom", () => {
    render(<button type="button">Guardar</button>);

    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });
});
