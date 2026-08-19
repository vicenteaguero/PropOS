import { describe, expect, it } from "vitest";
import { titleForPath } from "./page-meta";

describe("titleForPath", () => {
  it("names a listed route", () => {
    expect(titleForPath("/admin/personas")).toBe("Personas");
    expect(titleForPath("/admin/pendientes")).toBe("Pendientes");
  });

  it("lets a detail route inherit its list's name", () => {
    expect(titleForPath("/admin/personas/abc-123")).toBe("Personas");
  });

  it("matches the role root exactly, never as a prefix", () => {
    // `end: true` on the root. Without honouring it, every unlisted route under
    // /admin inherited "Inicio" — /admin/settings came out titled "Inicio".
    expect(titleForPath("/admin")).toBe("Inicio");
    expect(titleForPath("/admin/settings")).toBeNull();
    expect(titleForPath("/admin/ruta-que-no-existe")).toBeNull();
  });

  it("prefers the longest matching entry", () => {
    expect(titleForPath("/admin/documents")).toBe("Documentos");
    expect(titleForPath("/admin/documents/portals")).toBe("Enlaces");
  });

  it("returns null for routes the nav tree does not own", () => {
    expect(titleForPath("/login")).toBeNull();
    expect(titleForPath("/privacidad")).toBeNull();
  });
});
