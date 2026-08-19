import { describe, expect, it } from "vitest";
import { qs } from "./query-string";

/**
 * Ten feature api modules each carried a byte-identical private copy of this
 * while the shared one sat unimported. These tests pin the contract they all
 * relied on, so the single remaining copy can't drift.
 */
describe("qs", () => {
  it("prefixes with ? and joins pairs", () => {
    expect(qs({ q: "casa", limit: 10 })).toBe("?q=casa&limit=10");
  });

  it("returns an empty string when nothing survives, so it is safe to interpolate", () => {
    expect(qs({})).toBe("");
    expect(qs({ q: undefined, x: null, y: "" })).toBe("");
    expect(`/v1/tasks${qs({})}`).toBe("/v1/tasks");
  });

  it("drops undefined, null and empty values but keeps 0 and false", () => {
    expect(qs({ a: undefined, b: null, c: "", d: 0, e: false })).toBe("?d=0&e=false");
  });

  it("percent-encodes values", () => {
    expect(qs({ q: "casa & jardín" })).toBe("?q=casa+%26+jard%C3%ADn");
  });

  it("accepts a caller's typed params interface, not just an index signature", () => {
    interface ListParams {
      contactId?: string;
      q?: string;
    }
    const params: ListParams = { q: "ana" };
    expect(qs(params)).toBe("?q=ana");
  });
});
