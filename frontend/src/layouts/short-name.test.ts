import { describe, expect, it } from "vitest";
import { shortName } from "./short-name";

/**
 * `shortName` renders inside the bottom nav, which wraps every page of the
 * phone shell. A throw here is not a missing label — it white-screens the whole
 * PWA, which is exactly what a profile without `full_name` used to do.
 */
describe("shortName", () => {
  it("keeps a first name and the paternal surname", () => {
    expect(shortName("Juan Ignacio Pérez Salas")).toBe("Juan Pérez");
    expect(shortName("Vicente Agüero Cortés")).toBe("Vicente Agüero");
  });

  it("passes through what is already short", () => {
    expect(shortName("Ana Soto")).toBe("Ana Soto");
    expect(shortName("Ana")).toBe("Ana");
  });

  it("survives a profile with no name at all", () => {
    for (const input of [undefined, null, "", "   "]) {
      expect(shortName(input)).toBe("Mi cuenta");
    }
  });

  it("collapses stray whitespace instead of echoing it", () => {
    expect(shortName("  Ana   Soto  ")).toBe("Ana Soto");
  });
});
