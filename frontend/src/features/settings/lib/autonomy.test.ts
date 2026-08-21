import { describe, expect, it } from "vitest";
import {
  AUTONOMY_LEVELS,
  AUTONOMY_LEVEL_EFFECT,
  AUTONOMY_LEVEL_SHORT,
  isLoosened,
  levelLabel,
  levelRank,
  sortPoliciesForDisplay,
  type ActionPolicy,
  type AutonomyLevel,
} from "./autonomy";

function policy(over: Partial<ActionPolicy> = {}): ActionPolicy {
  return {
    action_kind: "create_person",
    level: "suggest",
    is_default: true,
    default_level: "suggest",
    ...over,
  };
}

describe("levelRank", () => {
  it("orders the levels from least to most autonomous", () => {
    expect(levelRank("observe")).toBeLessThan(levelRank("suggest"));
    expect(levelRank("suggest")).toBeLessThan(levelRank("execute"));
  });

  it("matches the order the switch paints them in", () => {
    const ranks = AUTONOMY_LEVELS.map(levelRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("isLoosened", () => {
  it("is false while the action sits at its code default", () => {
    expect(isLoosened(policy({ level: "execute", default_level: "execute" }))).toBe(false);
  });

  it("is false when the tenant tightened the action", () => {
    expect(
      isLoosened(policy({ level: "suggest", default_level: "execute", is_default: false })),
    ).toBe(false);
  });

  it("is true only when the tenant gave the action more freedom", () => {
    expect(
      isLoosened(policy({ level: "execute", default_level: "suggest", is_default: false })),
    ).toBe(true);
  });

  it("ignores an override that lands back on the default level", () => {
    // `is_default` is the server's word for "no row exists", so a row storing
    // the same value as the default is still an override — but not a loosened
    // one, and flagging it "Sin revisión" would be a lie.
    expect(
      isLoosened(policy({ level: "suggest", default_level: "suggest", is_default: false })),
    ).toBe(false);
  });
});

describe("sortPoliciesForDisplay", () => {
  it("orders by the Spanish label, not the English action_kind", () => {
    const sorted = sortPoliciesForDisplay([
      policy({ action_kind: "create_person" }), // "Crear persona"
      policy({ action_kind: "add_note" }), // "Agregar nota"
      policy({ action_kind: "attach_photos_to_property" }), // "Adjuntar fotos…"
    ]);
    expect(sorted.map((p) => p.action_kind)).toEqual([
      "attach_photos_to_property",
      "add_note",
      "create_person",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [policy({ action_kind: "create_person" }), policy({ action_kind: "add_note" })];
    sortPoliciesForDisplay(input);
    expect(input.map((p) => p.action_kind)).toEqual(["create_person", "add_note"]);
  });
});

describe("copy", () => {
  it("has a Spanish name and both explanations for every level", () => {
    for (const level of AUTONOMY_LEVELS satisfies readonly AutonomyLevel[]) {
      expect(levelLabel(level)).not.toBe(level);
      expect(AUTONOMY_LEVEL_EFFECT[level]).toBeTruthy();
      expect(AUTONOMY_LEVEL_SHORT[level]).toBeTruthy();
    }
  });
});
