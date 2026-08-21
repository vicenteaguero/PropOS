import { describe, expect, it } from "vitest";
import { withoutProposal } from "../lib/optimistic";

describe("withoutProposal", () => {
  it("drops the accepted/rejected row from a cached list", () => {
    const list = [
      { id: "a", status: "pending" },
      { id: "b", status: "pending" },
    ];
    expect(withoutProposal(list, "a")).toEqual([{ id: "b", status: "pending" }]);
  });

  it("leaves a list that does not contain the id alone", () => {
    const list = [{ id: "b", status: "pending" }];
    expect(withoutProposal(list, "a")).toEqual(list);
  });

  /**
   * The regression this exists for. `["pending"]` is a key PREFIX, so the
   * optimistic update also visits each card's `["pending","detail",id]` entry,
   * which holds ONE proposal object. Filtering that threw inside `onMutate`,
   * and a throw there aborts the mutation — Aceptar and Rechazar did nothing
   * on the Pendientes page, silently, because that page is what mounts the
   * cards that create those detail entries.
   */
  it("passes a single cached proposal through instead of throwing", () => {
    const detail = { id: "a", status: "pending" };
    expect(() => withoutProposal(detail, "a")).not.toThrow();
    expect(withoutProposal(detail, "a")).toBe(detail);
  });

  it("passes null and undefined through", () => {
    expect(withoutProposal(null, "a")).toBeNull();
    expect(withoutProposal(undefined, "a")).toBeUndefined();
  });
});
