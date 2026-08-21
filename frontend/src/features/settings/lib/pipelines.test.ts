import { describe, expect, it } from "vitest";
import {
  ANY_STAGE,
  destinationsFor,
  dropStage,
  isUnconstrained,
  modeFor,
  moveStage,
  pipelineIssue,
  renameStage,
  setMode,
  summarize,
  terminalDestinations,
  type PipelineTransition,
} from "./pipelines";

const RULES: PipelineTransition[] = [
  { from_stage: "LEAD", to_stage: "VISIT", requires_human: false },
  { from_stage: "VISIT", to_stage: "CLOSED", requires_human: true },
  { from_stage: null, to_stage: "LOST", requires_human: false },
];

describe("modeFor", () => {
  it("reads an ordinary rule as agent-permitted", () => {
    expect(modeFor(RULES, "LEAD", "VISIT")).toBe("agent");
  });

  it("reads requires_human as human-only", () => {
    expect(modeFor(RULES, "VISIT", "CLOSED")).toBe("human");
  });

  it("reads a missing row as forbidden", () => {
    expect(modeFor(RULES, "LEAD", "CLOSED")).toBe("none");
  });

  it("finds the wildcard rule under the ANY_STAGE key", () => {
    expect(modeFor(RULES, ANY_STAGE, "LOST")).toBe("agent");
  });

  it("does not let the wildcard answer for a named origin", () => {
    // "from anywhere" is matched by the backend at enforcement time; the editor
    // must show the wildcard row on its own card, not smeared over every stage.
    expect(modeFor(RULES, "LEAD", "LOST")).toBe("none");
  });
});

describe("setMode", () => {
  it("adds a row that did not exist", () => {
    const next = setMode(RULES, "LEAD", "CLOSED", "agent");
    expect(modeFor(next, "LEAD", "CLOSED")).toBe("agent");
    expect(next).toHaveLength(4);
  });

  it("flips requires_human without duplicating the row", () => {
    const next = setMode(RULES, "LEAD", "VISIT", "human");
    expect(modeFor(next, "LEAD", "VISIT")).toBe("human");
    expect(next).toHaveLength(3);
  });

  it("removes the row when the move becomes forbidden", () => {
    const next = setMode(RULES, "LEAD", "VISIT", "none");
    expect(modeFor(next, "LEAD", "VISIT")).toBe("none");
    expect(next).toHaveLength(2);
  });

  it("writes the wildcard rule with a null origin, not the sentinel", () => {
    const next = setMode([], ANY_STAGE, "LOST", "human");
    expect(next).toEqual([{ from_stage: null, to_stage: "LOST", requires_human: true }]);
  });

  it("leaves the other rules alone", () => {
    expect(setMode(RULES, "LEAD", "VISIT", "none")).toContainEqual(RULES[1]);
  });

  it("does not mutate its input", () => {
    setMode(RULES, "LEAD", "VISIT", "none");
    expect(RULES).toHaveLength(3);
  });
});

describe("isUnconstrained", () => {
  it("is true for an empty rule set, which is the dangerous case", () => {
    // `assert_allowed` returns early with no rows: every move becomes legal,
    // Propo included. Removing the last rule opens the pipeline, not closes it.
    expect(isUnconstrained([])).toBe(true);
  });

  it("is false as soon as one rule exists", () => {
    expect(isUnconstrained(RULES)).toBe(false);
  });
});

describe("summarize", () => {
  it("counts the rules, the human-only ones and the wildcards separately", () => {
    expect(summarize(RULES)).toEqual({ declared: 3, human: 1, fromAny: 1 });
  });

  it("is all zeros for a pipeline with no rules", () => {
    expect(summarize([])).toEqual({ declared: 0, human: 0, fromAny: 0 });
  });
});

describe("renameStage", () => {
  it("rewrites both ends so the rules keep matching", () => {
    const next = renameStage(RULES, "VISIT", "VISITA");
    expect(modeFor(next, "LEAD", "VISITA")).toBe("agent");
    expect(modeFor(next, "VISITA", "CLOSED")).toBe("human");
  });

  it("leaves the wildcard origin null rather than renaming it", () => {
    expect(
      renameStage(RULES, "LEAD", "X").find((t) => t.to_stage === "LOST")?.from_stage,
    ).toBeNull();
  });
});

describe("dropStage", () => {
  it("removes every rule that mentions the stage, from either end", () => {
    const next = dropStage(RULES, "VISIT");
    expect(next).toEqual([RULES[2]]);
  });

  it("keeps the rules that do not mention it", () => {
    expect(dropStage(RULES, "LEAD")).toHaveLength(2);
  });
});

describe("moveStage", () => {
  it("swaps with the neighbour above", () => {
    expect(moveStage(["A", "B", "C"], 1, -1)).toEqual(["B", "A", "C"]);
  });

  it("is a no-op at the ends", () => {
    const stages = ["A", "B"];
    expect(moveStage(stages, 0, -1)).toBe(stages);
    expect(moveStage(stages, 1, 1)).toBe(stages);
  });
});

describe("pipelineIssue", () => {
  it("passes a named pipeline with distinct stages", () => {
    expect(pipelineIssue("Ventas", ["LEAD", "CLOSED"])).toBeNull();
  });

  it("wants a name", () => {
    expect(pipelineIssue(" ", ["LEAD"])).toMatch(/nombre/i);
  });

  it("wants at least one stage", () => {
    expect(pipelineIssue("Ventas", [])).toMatch(/etapa/i);
  });

  it("points at the unnamed stage by its visible number", () => {
    expect(pipelineIssue("Ventas", ["LEAD", "  "])).toContain("etapa 2");
  });

  it("refuses duplicate stages, which would make rules ambiguous", () => {
    expect(pipelineIssue("Ventas", ["LEAD", "LEAD"])).toMatch(/mismo nombre/);
  });

  it("compares stages after trimming", () => {
    expect(pipelineIssue("Ventas", ["LEAD", "LEAD "])).toMatch(/mismo nombre/);
  });
});

describe("destinationsFor", () => {
  const STAGES = ["LEAD", "VISIT", "CLOSED"];

  it("keeps the stages in their declared order", () => {
    expect(destinationsFor(STAGES, [])).toEqual(["LEAD", "VISIT", "CLOSED"]);
  });

  it("includes a destination the rules name that is not a stage", () => {
    // Every seeded pipeline has `NULL -> LOST` while LOST is not one of the six
    // stages. An editor built only from `stages` would not render this rule,
    // and since saving replaces the whole set, it would delete it.
    expect(destinationsFor(STAGES, RULES)).toEqual(["LEAD", "VISIT", "CLOSED", "LOST"]);
  });

  it("does not duplicate a destination that is also a stage", () => {
    expect(destinationsFor(STAGES, RULES).filter((d) => d === "CLOSED")).toHaveLength(1);
  });

  it("takes the ones the user added by hand", () => {
    expect(destinationsFor(STAGES, [], ["ARCHIVED"])).toContain("ARCHIVED");
  });

  it("ignores blank stages so a half-typed row adds nothing", () => {
    expect(destinationsFor(["LEAD", ""], [])).toEqual(["LEAD"]);
  });
});

describe("terminalDestinations", () => {
  it("is exactly the destinations outside the flow", () => {
    const stages = ["LEAD", "VISIT", "CLOSED"];
    expect(terminalDestinations(stages, destinationsFor(stages, RULES))).toEqual(["LOST"]);
  });

  it("is empty when every destination is a stage", () => {
    expect(terminalDestinations(["A", "B"], ["A", "B"])).toEqual([]);
  });
});
