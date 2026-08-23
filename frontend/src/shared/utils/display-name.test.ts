import { describe, expect, it } from "vitest";
import { shortName, shortPropertyTitle } from "./display-name";

/**
 * `shortName` renders inside the bottom nav, which wraps every page of the
 * phone shell — a throw here is a white screen, not a missing label.
 */
describe("shortName", () => {
  it("keeps the first given name and the first surname", () => {
    expect(shortName("Juan Ignacio Pérez Salas")).toBe("Juan Pérez");
    expect(shortName("Vicente Agüero Cortés")).toBe("Vicente Agüero");
  });

  it("leaves a name that is already short alone", () => {
    expect(shortName("Ana Soto")).toBe("Ana Soto");
    expect(shortName("Ana")).toBe("Ana");
  });

  it("falls back rather than throwing on a profile with no name", () => {
    for (const input of [null, undefined, "", "   "]) {
      expect(shortName(input)).toBe("");
      expect(shortName(input, "Mi cuenta")).toBe("Mi cuenta");
    }
  });

  it("collapses stray whitespace", () => {
    expect(shortName("  Ana   Soto  ")).toBe("Ana Soto");
  });
});

describe("shortPropertyTitle", () => {
  it("keeps the two facts a list is scanned for: size and comuna", () => {
    expect(shortPropertyTitle("Departamento 3D/3B en venta en Macul")).toBe("3D/3B · Macul");
    expect(shortPropertyTitle("Casa 5D/4B en arriendo en San Miguel")).toBe("5D/4B · San Miguel");
  });

  it("keeps the kind when there is no bedroom count to keep", () => {
    expect(shortPropertyTitle("Local comercial en venta en Las Condes")).toBe(
      "Local comercial · Las Condes",
    );
  });

  it("returns a title it does not recognise untouched", () => {
    expect(shortPropertyTitle("Oficina Apoquindo 4700")).toBe("Oficina Apoquindo 4700");
    expect(shortPropertyTitle(null)).toBe("");
  });
});
