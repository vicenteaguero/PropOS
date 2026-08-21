import { describe, expect, it } from "vitest";
import {
  isValidColor,
  sortTags,
  swatchesFor,
  TAG_COLORS,
  tagIssue,
  unusedTags,
  type Tag,
} from "./tags";

function tag(name: string, usage_count = 0, over: Partial<Tag> = {}): Tag {
  return { id: name, name, color: null, usage_count, ...over };
}

describe("sortTags", () => {
  it("puts the most used first", () => {
    const rows = sortTags([tag("poco", 2), tag("mucho", 26), tag("medio", 10)]);
    expect(rows.map((t) => t.name)).toEqual(["mucho", "medio", "poco"]);
  });

  it("falls back to the name within a usage count", () => {
    expect(sortTags([tag("zeta", 5), tag("alfa", 5)]).map((t) => t.name)).toEqual(["alfa", "zeta"]);
  });

  it("does not mutate its input", () => {
    const input = [tag("a", 1), tag("b", 9)];
    sortTags(input);
    expect(input.map((t) => t.name)).toEqual(["a", "b"]);
  });
});

describe("unusedTags", () => {
  it("finds the labels nobody ever applied", () => {
    expect(unusedTags([tag("usada", 3), tag("huérfana", 0)]).map((t) => t.name)).toEqual([
      "huérfana",
    ]);
  });
});

describe("isValidColor", () => {
  it("accepts a six-digit hex in either case", () => {
    expect(isValidColor("#3b82f6")).toBe(true);
    expect(isValidColor("#3B82F6")).toBe(true);
  });

  it("accepts no colour at all", () => {
    expect(isValidColor(null)).toBe(true);
    expect(isValidColor("")).toBe(true);
  });

  it("rejects the shorthand and the missing hash", () => {
    expect(isValidColor("#fff")).toBe(false);
    expect(isValidColor("3b82f6")).toBe(false);
  });
});

describe("tagIssue", () => {
  const existing = [tag("Referido", 20, { id: "1" }), tag("Urgente", 18, { id: "2" })];

  it("passes a new distinct name", () => {
    expect(tagIssue("Inversionista", "#8b5cf6", existing)).toBeNull();
  });

  it("wants a name", () => {
    expect(tagIssue("  ", null, existing)).toMatch(/nombre/i);
  });

  it("rejects a malformed colour", () => {
    expect(tagIssue("Nueva", "azul", existing)).toMatch(/hex/i);
  });

  it("catches the UNIQUE (tenant_id, name) clash before the round trip", () => {
    expect(tagIssue("Referido", null, existing)).toMatch(/Ya existe/);
  });

  it("treats the clash as case-insensitive, the way a reader would", () => {
    expect(tagIssue("referido", null, existing)).toMatch(/Ya existe/);
  });

  it("lets a tag keep its own name while being edited", () => {
    expect(tagIssue("Referido", null, existing, "1")).toBeNull();
  });
});

describe("swatchesFor", () => {
  it("is just the palette when the tag has no colour", () => {
    expect(swatchesFor(null)).toHaveLength(TAG_COLORS.length);
  });

  it("does not duplicate a colour already in the palette", () => {
    expect(swatchesFor(TAG_COLORS[0])).toHaveLength(TAG_COLORS.length);
  });

  it("matches the palette case-insensitively", () => {
    expect(swatchesFor(TAG_COLORS[0].toUpperCase())).toHaveLength(TAG_COLORS.length);
  });

  it("appends a colour the seeded data uses that the palette does not", () => {
    // Without this the editor shows no swatch selected, and the first click
    // silently changes a colour the user never meant to touch.
    expect(swatchesFor("#94a3b8")).toContain("#94a3b8");
  });

  it("ignores a malformed colour rather than adding a broken swatch", () => {
    expect(swatchesFor("azul")).toHaveLength(TAG_COLORS.length);
  });
});
