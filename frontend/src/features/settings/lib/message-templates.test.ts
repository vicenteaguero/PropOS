import { describe, expect, it } from "vitest";
import {
  isSendable,
  matchesQuery,
  nextSlot,
  segmentBody,
  slotsIn,
  sortTemplates,
  syncVariables,
  templateIssue,
  type MessageTemplate,
} from "./message-templates";

function template(over: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: "1",
    name: "visit_confirmation",
    channel: "whatsapp",
    category: "utility",
    language: "es",
    body: "Hola {{1}}",
    variables: ["contact_name"],
    external_name: null,
    approval_status: "approved",
    approved_at: null,
    updated_at: null,
    ...over,
  };
}

describe("slotsIn", () => {
  it("deduplicates and sorts", () => {
    expect(slotsIn("{{2}} y {{1}} y otra vez {{2}}")).toEqual([1, 2]);
  });

  it("tolerates the whitespace the WhatsApp Manager emits", () => {
    expect(slotsIn("Hola {{ 1 }}")).toEqual([1]);
  });

  it("finds nothing in a body with no variables", () => {
    expect(slotsIn("Gracias por escribirnos.")).toEqual([]);
  });
});

describe("segmentBody", () => {
  it("puts each name where its value will go", () => {
    const segments = segmentBody("Hola {{1}}, visita a {{2}}.", ["nombre", "direccion"]);
    expect(segments).toEqual([
      { kind: "text", text: "Hola " },
      { kind: "slot", index: 1, name: "nombre" },
      { kind: "text", text: ", visita a " },
      { kind: "slot", index: 2, name: "direccion" },
      { kind: "text", text: "." },
    ]);
  });

  it("maps by position, not by order of appearance", () => {
    // `{{2}}` first in the text still takes variables[1].
    const segments = segmentBody("{{2}} antes que {{1}}", ["uno", "dos"]);
    expect(segments.filter((s) => s.kind === "slot")).toEqual([
      { kind: "slot", index: 2, name: "dos" },
      { kind: "slot", index: 1, name: "uno" },
    ]);
  });

  it("reports a slot with no name rather than rendering a blank", () => {
    const [, slot] = segmentBody("Hola {{1}}", []);
    expect(slot).toEqual({ kind: "slot", index: 1, name: null });
  });

  it("treats a whitespace-only name as missing", () => {
    const [, slot] = segmentBody("Hola {{1}}", ["   "]);
    expect(slot).toEqual({ kind: "slot", index: 1, name: null });
  });

  it("keeps a body with no slots in one piece", () => {
    expect(segmentBody("Gracias.", [])).toEqual([{ kind: "text", text: "Gracias." }]);
  });
});

describe("syncVariables", () => {
  it("grows the array when the body gains a slot", () => {
    expect(syncVariables("{{1}} {{2}}", ["a"])).toEqual(["a", ""]);
  });

  it("drops names whose slot was deleted", () => {
    expect(syncVariables("{{1}}", ["a", "b"])).toEqual(["a"]);
  });

  it("empties the array when the last slot goes", () => {
    expect(syncVariables("sin variables", ["a"])).toEqual([]);
  });
});

describe("nextSlot", () => {
  it("starts at one", () => {
    expect(nextSlot("Hola")).toBe(1);
  });

  it("continues after the slots already used", () => {
    expect(nextSlot("Hola {{1}} y {{2}}")).toBe(3);
  });
});

describe("templateIssue", () => {
  it("passes a well-formed template", () => {
    expect(templateIssue("aviso", "Hola {{1}}", ["nombre"])).toBeNull();
  });

  it("wants a name", () => {
    expect(templateIssue("  ", "Hola", [])).toMatch(/nombre/i);
  });

  it("wants a body", () => {
    expect(templateIssue("aviso", "", [])).toMatch(/mensaje/i);
  });

  it("refuses a gap in the numbering", () => {
    expect(templateIssue("aviso", "{{1}} y {{3}}", ["a", "b"])).toMatch(/sin saltarse/);
  });

  it("names the slot that has no variable", () => {
    expect(templateIssue("aviso", "{{1}} {{2}}", ["nombre", ""])).toContain("{{2}}");
  });

  it("refuses two variables with the same name", () => {
    expect(templateIssue("aviso", "{{1}} {{2}}", ["x", "x"])).toMatch(/mismo nombre/);
  });
});

describe("sortTemplates", () => {
  it("puts what can be sent first and the drafts last", () => {
    const rows = sortTemplates([
      template({ id: "d", name: "d", approval_status: "draft" }),
      template({ id: "r", name: "r", approval_status: "rejected" }),
      template({ id: "a", name: "a", approval_status: "approved" }),
      template({ id: "s", name: "s", approval_status: "submitted" }),
    ]);
    expect(rows.map((t) => t.id)).toEqual(["a", "s", "r", "d"]);
  });

  it("falls back to the name within a status", () => {
    const rows = sortTemplates([
      template({ id: "2", name: "zeta" }),
      template({ id: "1", name: "alfa" }),
    ]);
    expect(rows.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("does not mutate its input", () => {
    const input = [template({ id: "d", approval_status: "draft" }), template({ id: "a" })];
    sortTemplates(input);
    expect(input.map((t) => t.id)).toEqual(["d", "a"]);
  });
});

describe("isSendable", () => {
  it("is true only for approved", () => {
    expect(isSendable(template({ approval_status: "approved" }))).toBe(true);
    for (const status of ["draft", "submitted", "rejected"] as const) {
      expect(isSendable(template({ approval_status: status }))).toBe(false);
    }
  });
});

describe("matchesQuery", () => {
  it("matches on the body and on a variable name, not just the title", () => {
    const row = template({ name: "aviso", body: "Hola {{1}}", variables: ["property_address"] });
    expect(matchesQuery(row, "hola")).toBe(true);
    expect(matchesQuery(row, "address")).toBe(true);
    expect(matchesQuery(row, "nada")).toBe(false);
  });

  it("matches everything when the query is blank", () => {
    expect(matchesQuery(template(), "   ")).toBe(true);
  });
});
