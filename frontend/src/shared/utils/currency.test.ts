import { describe, expect, it } from "vitest";
import { abbreviateClp, formatClp, formatUf } from "./currency";

describe("formatClp", () => {
  it("formats cents as CLP pesos", () => {
    expect(formatClp(100_000_00)).toContain("100.000");
  });

  it("returns dash for null/undefined", () => {
    expect(formatClp(null)).toBe("—");
    expect(formatClp(undefined)).toBe("—");
  });

  it("has no decimals", () => {
    expect(formatClp(1_500_00)).not.toContain(",00");
  });
});

describe("abbreviateClp", () => {
  it("collapses a Chilean property price to something a column can hold", () => {
    // "$185.000.000" is fourteen characters, wider than the title above it.
    expect(abbreviateClp(185_000_000_00)).toBe("$185M");
    expect(abbreviateClp(4_200_000_00)).toBe("$4,2M");
    expect(abbreviateClp(850_000_00)).toBe("$850K");
  });

  it("keeps one decimal only where it carries information", () => {
    expect(abbreviateClp(185_400_000_00)).toBe("$185M");
    expect(abbreviateClp(4_250_000_00)).toBe("$4,3M");
  });

  it("falls back rather than printing a bare currency symbol", () => {
    expect(abbreviateClp(null)).toBe("—");
    expect(abbreviateClp(undefined, "Precio a convenir")).toBe("Precio a convenir");
  });
});

describe("formatUf", () => {
  it("prints the unit and no decimals", () => {
    expect(formatUf(4200)).toBe("UF 4.200");
    expect(formatUf(null)).toBe("—");
  });
});
