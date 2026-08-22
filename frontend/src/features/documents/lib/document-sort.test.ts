import { describe, expect, it } from "vitest";
import { sortDocuments } from "./document-sort";
import type { DocumentItem } from "../types";

function doc(over: Partial<DocumentItem> & { id: string }): DocumentItem {
  return {
    tenant_id: "t",
    display_name: over.id,
    kind: "PDF",
    origin: "UPLOAD",
    tag: null,
    current_version_id: null,
    sort_order: 0,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...over,
  } as DocumentItem;
}

const ids = (docs: DocumentItem[]) => docs.map((d) => d.id);

describe("sortDocuments", () => {
  it("puts the most recently opened first", () => {
    const docs = [
      doc({ id: "old", last_opened_at: "2026-01-01T00:00:00Z" }),
      doc({ id: "new", last_opened_at: "2026-08-01T00:00:00Z" }),
    ];
    expect(ids(sortDocuments(docs, "recent"))[0]).toBe("new");
  });

  it("sinks never-opened documents below opened ones", () => {
    // A missing stamp must not be read as epoch-zero-but-equal, and must not
    // outrank a real one. This is the case that makes "recent" usable at all
    // on a tenant that has just turned the feature on.
    const docs = [
      doc({ id: "never" }),
      doc({ id: "opened", last_opened_at: "2026-08-01T00:00:00Z" }),
    ];
    expect(ids(sortDocuments(docs, "recent"))).toEqual(["opened", "never"]);
  });

  it("breaks ties by newest created", () => {
    const docs = [
      doc({ id: "a", created_at: "2026-01-01T00:00:00Z" }),
      doc({ id: "b", created_at: "2026-05-01T00:00:00Z" }),
    ];
    expect(ids(sortDocuments(docs, "recent"))).toEqual(["b", "a"]);
  });

  it("orders by name using Spanish collation", () => {
    const docs = [doc({ id: "z", display_name: "Ñandú" }), doc({ id: "a", display_name: "Nota" })];
    expect(ids(sortDocuments(docs, "name"))).toEqual(["a", "z"]);
  });

  it("floats priority documents to the top", () => {
    const docs = [doc({ id: "plain" }), doc({ id: "starred", is_priority: true })];
    expect(ids(sortDocuments(docs, "priority"))).toEqual(["starred", "plain"]);
  });

  it("does not mutate the input array", () => {
    const docs = [doc({ id: "b" }), doc({ id: "a" })];
    sortDocuments(docs, "name");
    expect(ids(docs)).toEqual(["b", "a"]);
  });

  it("handles an empty list", () => {
    expect(sortDocuments([], "recent")).toEqual([]);
  });
});
