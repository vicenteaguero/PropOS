import { describe, expect, it } from "vitest";
import { titleForPath } from "./page-meta";

describe("titleForPath", () => {
  it("names a listed route", () => {
    expect(titleForPath("/admin/crm")).toBe("CRM");
    expect(titleForPath("/admin/pendientes")).toBe("Pendientes");
  });

  it("names a detail route the nav no longer lists", () => {
    // The list pages became tabs, so /admin/personas is only a redirect — but
    // /admin/personas/:id is still a page and still needs a tab title.
    expect(titleForPath("/admin/personas/abc-123")).toBe("Personas");
    expect(titleForPath("/admin/properties/abc-123")).toBe("Propiedades");
  });

  it("matches the role root exactly, never as a prefix", () => {
    // `end: true` on the root. Without honouring it, every unlisted route under
    // /admin inherited "Inicio" — /admin/settings came out titled "Inicio".
    expect(titleForPath("/admin")).toBe("Inicio");
    expect(titleForPath("/admin/ruta-que-no-existe")).toBeNull();
  });

  it("names Configuración, which is now a real nav destination", () => {
    // It used to be hard-coded in two shells and absent from the tree; the
    // admin section (usuarios, teléfonos, importar, tenants…) now lives behind
    // it, so it has to carry a title of its own.
    expect(titleForPath("/admin/settings")).toBe("Configuración");
  });

  it("prefers the longest matching entry", () => {
    expect(titleForPath("/admin/documentos")).toBe("Documentos");
    expect(titleForPath("/admin/crm")).toBe("CRM");
  });

  it("keeps a section's own name when an entry points at one of its tabs", () => {
    // /admin/crm?tab=propiedades shares a pathname with the CRM entry; the
    // section wins so the tab does not rename the whole page.
    expect(titleForPath("/admin/crm")).toBe("CRM");
  });

  it("returns null for routes the nav tree does not own", () => {
    expect(titleForPath("/login")).toBeNull();
    expect(titleForPath("/privacidad")).toBeNull();
  });
});
