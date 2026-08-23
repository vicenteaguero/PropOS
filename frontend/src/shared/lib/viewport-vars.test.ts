import { describe, expect, it } from "vitest";
import { computeSnapshot, isEditableElement, sameSnapshot } from "./viewport-vars";
import type { ComputeInput } from "./viewport-vars";

function input(over: Partial<ComputeInput> = {}): ComputeInput {
  return {
    reading: { innerHeight: 844, vvHeight: 844, vvOffsetTop: 0 },
    restHeight: 844,
    editableFocused: false,
    wasOpen: false,
    ...over,
  };
}

describe("computeSnapshot — iOS (layout viewport does not shrink)", () => {
  it("reports the covered strip and opens", () => {
    const { snapshot } = computeSnapshot(
      input({
        reading: { innerHeight: 844, vvHeight: 508, vvOffsetTop: 0 },
        editableFocused: true,
      }),
    );
    expect(snapshot.kbInset).toBe(336);
    expect(snapshot.kbOpen).toBe(true);
    expect(snapshot.vvHeight).toBe(508);
  });

  it("stays layout-relative when the visual viewport is scrolled", () => {
    // iOS scrolls the visible box under a focused input. The distance from a
    // layout-positioned element to the visible bottom shrinks accordingly.
    const { snapshot } = computeSnapshot(
      input({
        reading: { innerHeight: 844, vvHeight: 508, vvOffsetTop: 120 },
        editableFocused: true,
      }),
    );
    expect(snapshot.kbInset).toBe(216);
    expect(snapshot.vvTop).toBe(120);
  });
});

describe("computeSnapshot — Android (interactive-widget=resizes-content)", () => {
  it("detects the keyboard from the shrunken layout viewport", () => {
    const { snapshot } = computeSnapshot(
      input({
        reading: { innerHeight: 400, vvHeight: 400, vvOffsetTop: 0 },
        restHeight: 844,
        editableFocused: true,
      }),
    );
    // Nothing is "covered" — the page itself got shorter.
    expect(snapshot.kbInset).toBe(0);
    expect(snapshot.kbOpen).toBe(true);
  });
});

describe("computeSnapshot — restHeight recovery", () => {
  it("survives a cold mount with the keyboard already open", () => {
    // The bug: restHeight seeded from a shrunken innerHeight then reported
    // kbOpen=false forever for that instance.
    const { snapshot, restHeight } = computeSnapshot(
      input({
        reading: { innerHeight: 844, vvHeight: 508, vvOffsetTop: 0 },
        restHeight: 0,
        editableFocused: true,
      }),
    );
    expect(restHeight).toBe(844);
    expect(snapshot.kbOpen).toBe(true);
  });

  it("grows monotonically", () => {
    const { restHeight } = computeSnapshot(
      input({ reading: { innerHeight: 900, vvHeight: 900, vvOffsetTop: 0 }, restHeight: 844 }),
    );
    expect(restHeight).toBe(900);
  });
});

describe("computeSnapshot — the rotation false positive", () => {
  it("does not claim a keyboard from a stale portrait restHeight", () => {
    // Rotating to landscape: innerHeight 390 against a portrait restHeight of
    // 844 gives shrunk=454. Without the focus requirement this stuck at open.
    const { snapshot } = computeSnapshot(
      input({
        reading: { innerHeight: 390, vvHeight: 390, vvOffsetTop: 0 },
        restHeight: 844,
        editableFocused: false,
      }),
    );
    expect(snapshot.kbOpen).toBe(false);
  });
});

describe("computeSnapshot — the latch", () => {
  const covered = { innerHeight: 844, vvHeight: 508, vvOffsetTop: 0 };

  it("does not raise without a focused editable", () => {
    expect(computeSnapshot(input({ reading: covered })).snapshot.kbOpen).toBe(false);
  });

  it("stays open when focus leaves but the keyboard is still up", () => {
    // Tapping "send" blurs the input; the keys are still there for a moment.
    const { snapshot } = computeSnapshot(
      input({ reading: covered, editableFocused: false, wasOpen: true }),
    );
    expect(snapshot.kbOpen).toBe(true);
  });

  it("closes once the geometry says the strip is gone", () => {
    const { snapshot } = computeSnapshot(
      input({
        reading: { innerHeight: 844, vvHeight: 844, vvOffsetTop: 0 },
        editableFocused: false,
        wasOpen: true,
      }),
    );
    expect(snapshot.kbOpen).toBe(false);
  });

  it("ignores a strip smaller than a keyboard", () => {
    // A collapsing URL bar is ~60px and must not read as a keyboard.
    const { snapshot } = computeSnapshot(
      input({
        reading: { innerHeight: 844, vvHeight: 790, vvOffsetTop: 0 },
        editableFocused: true,
      }),
    );
    expect(snapshot.kbOpen).toBe(false);
  });
});

describe("sameSnapshot", () => {
  it("is true only when every field matches", () => {
    const a = { kbInset: 1, kbOpen: true, vvHeight: 2, vvTop: 3 };
    expect(sameSnapshot(a, { ...a })).toBe(true);
    expect(sameSnapshot(a, { ...a, vvTop: 4 })).toBe(false);
  });
});

describe("isEditableElement", () => {
  it("recognises form controls and contenteditable", () => {
    expect(isEditableElement(document.createElement("input"))).toBe(true);
    expect(isEditableElement(document.createElement("textarea"))).toBe(true);
    const div = document.createElement("div");
    expect(isEditableElement(div)).toBe(false);
    // The attribute, not the property: jsdom does not implement
    // `isContentEditable` and its setter does not reflect to the attribute, so
    // the property branch is only reachable in a real browser.
    div.setAttribute("contenteditable", "true");
    expect(isEditableElement(div)).toBe(true);
  });

  it("handles null", () => {
    expect(isEditableElement(null)).toBe(false);
  });
});
