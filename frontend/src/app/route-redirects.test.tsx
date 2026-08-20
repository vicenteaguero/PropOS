import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";

function TabProbe() {
  const [params] = useSearchParams();
  return <div data-testid="landed">{params.get("tab")}</div>;
}

/**
 * The old list routes (/admin/tareas, /admin/bandeja, …) became redirects into a
 * section tab. Push notifications and links people already saved point at them,
 * so the `../section?tab=x` form has to resolve against the ROLE segment, not
 * the app root — a regression here is silent: the user lands on a 404 redirect
 * to "/" and nothing in CI notices.
 */
describe("legacy list routes", () => {
  it("redirect into the section tab, keeping the role segment", () => {
    render(
      <MemoryRouter initialEntries={["/admin/tareas"]}>
        <Routes>
          <Route path="/admin">
            <Route path="agenda" element={<TabProbe />} />
            <Route path="tareas" element={<Navigate to="../agenda?tab=tareas" replace />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("landed").textContent).toBe("tareas");
  });
});
