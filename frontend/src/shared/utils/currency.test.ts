import { describe, expect, it } from "vitest";
import { formatClp } from "./currency";

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
