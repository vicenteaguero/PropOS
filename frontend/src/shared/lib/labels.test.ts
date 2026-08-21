import { describe, expect, it } from "vitest";
import { INTERACTION_KINDS, INTERACTION_KIND_LABELS_SHARED, label } from "./labels";

/**
 * Two registries of interaction kinds used to exist and disagree on four of
 * eight keys: this one carried `MESSAGE` and `WHATSAPP`, which the
 * `interaction_kind` enum has never contained, and lacked `WHATSAPP_LOG` and
 * `SHOWING`, which it does. The visible result was every WhatsApp interaction
 * rendering its raw key wherever it went through `label()`.
 */
const ENUM_VALUES = [
  "VISIT",
  "CALL",
  "EMAIL",
  "WHATSAPP_LOG",
  "NOTE",
  "MEETING",
  "SHOWING",
  "OTHER",
] as const;

describe("interaction kinds", () => {
  it("matches the database enum exactly", () => {
    expect([...INTERACTION_KINDS].sort()).toEqual([...ENUM_VALUES].sort());
  });

  it("has a Spanish label for every kind, so none renders as a raw key", () => {
    for (const kind of ENUM_VALUES) {
      const text = label("interactionKind", kind);
      expect(text).not.toBe(kind);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("labels a WhatsApp interaction, the case that was broken", () => {
    expect(label("interactionKind", "WHATSAPP_LOG")).toBe("WhatsApp");
  });

  it("does not carry keys the enum has no value for", () => {
    expect(INTERACTION_KIND_LABELS_SHARED).not.toHaveProperty("MESSAGE");
    expect(INTERACTION_KIND_LABELS_SHARED).not.toHaveProperty("WHATSAPP");
  });

  it("falls back to the raw value for something genuinely unknown", () => {
    expect(label("interactionKind", "TELEPATIA")).toBe("TELEPATIA");
  });
});
