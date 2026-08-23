import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { LEGACY_AGENDA_ROUTES, LEGACY_CLIENT_ROUTES, type LegacyRoute } from "./legacy-routes";

function Landed({ section }: { section: string }) {
  const [params] = useSearchParams();
  return <div data-testid="landed">{`${section}:${params.get("tab") ?? ""}`}</div>;
}

/**
 * Old list routes (/admin/crm, /admin/bandeja, /admin/tareas, …) are redirects
 * into a section tab. Push notifications and links people saved months ago
 * still point at them, and a regression is SILENT: the user falls through to
 * the catch-all and gets bounced to "/".
 *
 * The table under test is the one the router actually renders, imported rather
 * than retyped — the previous version of this test rebuilt the routes inline,
 * so it only ever proved that `<Navigate>` works.
 */
function landOn(entry: string, routes: LegacyRoute[], section: string) {
  render(
    <MemoryRouter initialEntries={[`/admin/${entry}`]}>
      <Routes>
        <Route path="/admin">
          <Route path={section} element={<Landed section={section} />} />
          {/* Personas and Propiedades stopped being tabs and became their own
              routes, so a redirect can now legitimately point outside the
              section. Declared here so those entries land somewhere. */}
          <Route path="personas" element={<Landed section="personas" />} />
          <Route path="propiedades" element={<Landed section="propiedades" />} />
          {routes.map(({ from, to }) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByTestId("landed").textContent ?? "";
}

/** The section a legacy `to` lands in — the path, not the tab. */
function sectionOf(to: string): string {
  return new URL(to, "http://x/").pathname.replace(/^.*\//, "");
}

describe("legacy Clientes routes", () => {
  it.each(LEGACY_CLIENT_ROUTES)("$from lands inside clientes", ({ from, to }) => {
    const expectedTab = new URL(to, "http://x/").searchParams.get("tab") ?? "";
    const expectedSection = sectionOf(to);
    expect(landOn(from, LEGACY_CLIENT_ROUTES, "clientes")).toBe(
      `${expectedSection}:${expectedTab}`,
    );
  });

  it("keeps every tab alias the section still answers to", () => {
    // A `to` pointing at a tab id the section does not declare would silently
    // fall through to the first tab. These are the ids and aliases in
    // clients-section-page.tsx.
    const known = new Set([
      "conversaciones",
      "atencion",
      "bandeja",
      "whatsapp",
      "correos",
      "personas",
      "interacciones",
      "negocios",
      "pipeline",
      "oportunidades",
      "propiedades",
      "",
    ]);
    for (const { to } of LEGACY_CLIENT_ROUTES) {
      const tab = new URL(to, "http://x/").searchParams.get("tab") ?? "";
      expect(known, `unknown tab "${tab}"`).toContain(tab);
    }
  });
});

describe("legacy Agenda routes", () => {
  it.each(LEGACY_AGENDA_ROUTES)("$from lands inside agenda", ({ from, to }) => {
    const expectedTab = new URL(to, "http://x/").searchParams.get("tab") ?? "";
    expect(landOn(from, LEGACY_AGENDA_ROUTES, "agenda")).toBe(`agenda:${expectedTab}`);
  });
});
