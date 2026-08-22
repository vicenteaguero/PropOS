import { describe, expect, it } from "vitest";
import { recordPath } from "./record-route";
import type { PendingProposal } from "@features/agent/types";

const proposal = (table: string | null, id: string | null) =>
  ({ target_table: table, created_row_id: id }) as PendingProposal;

describe("recordPath", () => {
  it("sends a created contact to its own page", () => {
    expect(recordPath(proposal("contacts", "c1"), "admin")).toBe("/admin/personas/c1");
  });

  it("falls back to the universal timeline for rows with no detail page", () => {
    expect(recordPath(proposal("tasks", "t1"), "admin")).toBe("/admin/timeline/tasks/t1");
  });

  it("sends media_assets to the PROPERTY, because that is what the id is", () => {
    // `_accept_attach_photos_to_property` returns the property id under the
    // table name `media_assets`. Trusting the name would 404.
    expect(recordPath(proposal("media_assets", "p1"), "admin")).toBe("/admin/propiedades/p1");
  });

  it("has nowhere to go when nothing was created", () => {
    expect(recordPath(proposal("contacts", null), "admin")).toBeNull();
    expect(recordPath(proposal(null, "x"), "admin")).toBeNull();
  });

  it("respects the caller's role root", () => {
    expect(recordPath(proposal("properties", "p2"), "agent")).toBe("/agent/propiedades/p2");
  });
});
