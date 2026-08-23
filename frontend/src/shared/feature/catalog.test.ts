import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FEATURE_KEYS,
  WIP_NOTES,
  entryFor,
  isEnabled,
  isVisible,
  wipNoteFor,
  type FeatureMap,
} from "./catalog";

/**
 * The catalog lives twice -- once in Python, once here -- because the backend
 * enforces it and the frontend draws it. A key present on only one side is the
 * worst kind of bug this system can have: the switchboard shows a control that
 * changes nothing, or a screen obeys a state no one can set.
 */
describe("feature catalog parity", () => {
  it("matches backend/app/core/features.py", () => {
    const source = readFileSync(
      resolve(__dirname, "../../../../backend/app/core/features.py"),
      "utf8",
    );
    const block = source.split("CATALOG: tuple[Feature, ...] = (")[1]?.split("\n)")[0] ?? "";
    const backendKeys = [...block.matchAll(/Feature\("([a-z_]+)"/g)].map((m) => m[1]);

    expect(backendKeys.length).toBeGreaterThan(0);
    expect([...backendKeys].sort()).toEqual([...FEATURE_KEYS].sort());
  });
});

describe("state resolution", () => {
  const map: FeatureMap = {
    locked: { state: "locked", note: "Falta conectar WhatsApp" },
    hidden: { state: "hidden", note: null },
    wip: { state: "wip", note: null },
  };

  it("treats an unknown key as on", () => {
    expect(entryFor(map, "nope")).toEqual({ state: "on", note: null });
    expect(isVisible(map, "nope")).toBe(true);
    expect(isEnabled(map, "nope")).toBe(true);
  });

  it("treats a missing key as on, so a failed fetch cannot black out the app", () => {
    expect(isVisible({}, "crm")).toBe(true);
    expect(isEnabled({}, "crm")).toBe(true);
  });

  it("keeps a locked feature visible but not usable", () => {
    expect(isVisible(map, "locked")).toBe(true);
    expect(isEnabled(map, "locked")).toBe(false);
  });

  it("drops a hidden feature entirely", () => {
    expect(isVisible(map, "hidden")).toBe(false);
    expect(isEnabled(map, "hidden")).toBe(false);
  });

  it("leaves a wip feature fully usable", () => {
    expect(isVisible(map, "wip")).toBe(true);
    expect(isEnabled(map, "wip")).toBe(true);
  });

  it("says yes when no key is asked about", () => {
    expect(isVisible(map, undefined)).toBe(true);
    expect(isEnabled(map, undefined)).toBe(true);
  });
});

describe("wip notes", () => {
  it("has a broker-facing sentence for every key", () => {
    for (const key of FEATURE_KEYS) {
      expect(WIP_NOTES[key], key).toBeTruthy();
    }
  });

  it("prefers the tenant's own note over the default", () => {
    expect(wipNoteFor({ finanzas: { state: "wip", note: "Lo pidió la dueña" } }, "finanzas")).toBe(
      "Lo pidió la dueña",
    );
    expect(wipNoteFor({}, "finanzas")).toBe(WIP_NOTES.finanzas);
    expect(wipNoteFor({}, undefined)).toBeNull();
  });
});
