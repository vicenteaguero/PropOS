import { describe, expect, it } from "vitest";
import {
  blankItem,
  checklistIssue,
  countBlocking,
  horizonDays,
  moveItem,
  removeItem,
  renumber,
  type ChecklistItem,
} from "./checklist-templates";

function item(title: string, over: Partial<ChecklistItem> = {}): ChecklistItem {
  return { ...blankItem(1), title, ...over };
}

const LIST = [item("Estudio de títulos"), item("Tasación"), item("Escritura")];

describe("renumber", () => {
  it("numbers from one in array order", () => {
    expect(renumber(LIST).map((i) => i.position)).toEqual([1, 2, 3]);
  });
});

describe("moveItem", () => {
  it("swaps with the neighbour above and renumbers", () => {
    const moved = moveItem(renumber(LIST), 1, -1);
    expect(moved.map((i) => i.title)).toEqual(["Tasación", "Estudio de títulos", "Escritura"]);
    expect(moved.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it("swaps with the neighbour below", () => {
    expect(moveItem(renumber(LIST), 0, 1).map((i) => i.title)).toEqual([
      "Tasación",
      "Estudio de títulos",
      "Escritura",
    ]);
  });

  it("is a no-op at the top", () => {
    expect(moveItem(LIST, 0, -1)).toBe(LIST);
  });

  it("is a no-op at the bottom", () => {
    expect(moveItem(LIST, 2, 1)).toBe(LIST);
  });

  it("does not mutate the list it was given", () => {
    const input = renumber(LIST);
    moveItem(input, 0, 1);
    expect(input.map((i) => i.title)).toEqual(["Estudio de títulos", "Tasación", "Escritura"]);
  });
});

describe("removeItem", () => {
  it("closes the gap in the numbering", () => {
    const left = removeItem(renumber(LIST), 0);
    expect(left.map((i) => i.title)).toEqual(["Tasación", "Escritura"]);
    expect(left.map((i) => i.position)).toEqual([1, 2]);
  });
});

describe("countBlocking", () => {
  it("counts only the steps that stop the close", () => {
    expect(
      countBlocking([item("a", { blocking: true }), item("b"), item("c", { blocking: true })]),
    ).toBe(2);
  });
});

describe("horizonDays", () => {
  it("is the furthest deadline in the list", () => {
    expect(
      horizonDays([item("a", { due_offset_days: 10 }), item("b", { due_offset_days: 60 })]),
    ).toBe(60);
  });

  it("is null when nothing has a deadline", () => {
    expect(horizonDays([item("a")])).toBeNull();
  });

  it("ignores the steps without one instead of treating them as zero", () => {
    expect(horizonDays([item("a"), item("b", { due_offset_days: 5 })])).toBe(5);
  });
});

describe("checklistIssue", () => {
  it("passes a named list with titled steps", () => {
    expect(checklistIssue("Cierre de venta", LIST)).toBeNull();
  });

  it("wants a name", () => {
    expect(checklistIssue("  ", LIST)).toMatch(/nombre/i);
  });

  it("wants at least one step", () => {
    expect(checklistIssue("Cierre", [])).toMatch(/paso/i);
  });

  it("points at the step that has no title, by its visible number", () => {
    expect(checklistIssue("Cierre", [item("Tasación"), item("")])).toContain("paso 2");
  });
});
