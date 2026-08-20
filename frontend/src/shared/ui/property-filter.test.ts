import { describe, expect, it } from "vitest";
import { rankProperties, type FilterableProperty } from "./property-filter";

const p = (over: Partial<FilterableProperty> & { id: string }): FilterableProperty => ({
  title: over.id,
  status: "AVAILABLE",
  is_draft: false,
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("rankProperties", () => {
  it("puts published-available first, then active, then the rest", () => {
    const out = rankProperties([
      p({ id: "sold", status: "SOLD" }),
      p({ id: "draft", is_draft: true }),
      p({ id: "live" }),
      p({ id: "reserved", status: "RESERVED" }),
    ]);
    expect(out.map((x) => x.id)).toEqual(["live", "draft", "reserved", "sold"]);
  });

  it("breaks ties by most recently touched", () => {
    const out = rankProperties([
      p({ id: "old", updated_at: "2026-01-01T00:00:00Z" }),
      p({ id: "new", updated_at: "2026-08-20T00:00:00Z" }),
    ]);
    expect(out.map((x) => x.id)).toEqual(["new", "old"]);
  });

  it("does not mutate its input", () => {
    const input = [p({ id: "b", status: "SOLD" }), p({ id: "a" })];
    rankProperties(input);
    expect(input.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("tolerates missing status and dates", () => {
    const out = rankProperties([{ id: "x", title: null }, p({ id: "live" })]);
    expect(out.map((x) => x.id)).toEqual(["live", "x"]);
  });
});
