import { describe, expect, it } from "vitest";
import { comunasIn, filterDeals, orderDeals } from "./deal-filters";
import type { Opportunity } from "../types";

const deal = (over: Partial<Opportunity>): Opportunity =>
  ({
    id: "d",
    tenant_id: "t",
    pipeline_id: null,
    person_id: null,
    property_id: null,
    project_id: null,
    pipeline_stage: "NEW",
    status: "OPEN",
    expected_close_at: null,
    expected_value_cents: null,
    currency: "CLP",
    probability: null,
    lost_reason: null,
    notes: null,
    extra_participants: 0,
    extra_properties: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    ...over,
  }) as Opportunity;

describe("filterDeals", () => {
  const deals = [
    deal({ id: "a", comunas: ["Macul"] }),
    deal({ id: "b", comunas: ["Las Condes", "Vitacura"] }),
    deal({ id: "c", comunas: [] }),
  ];

  it("keeps a deal whose SECOND property is in the comuna", () => {
    // The version this replaces read only the principal `property_id`, so a
    // buyer looking at three flats across two comunas matched neither.
    expect(filterDeals(deals, { comuna: "Vitacura" }).map((d) => d.id)).toEqual(["b"]);
  });

  it("matches the principal property too", () => {
    expect(filterDeals(deals, { comuna: "Macul" }).map((d) => d.id)).toEqual(["a"]);
  });

  it("drops deals with no comuna at all when one is chosen", () => {
    expect(filterDeals(deals, { comuna: "Macul" }).some((d) => d.id === "c")).toBe(false);
  });

  it("returns everything when no comuna is chosen", () => {
    expect(filterDeals(deals, { comuna: null })).toHaveLength(3);
  });

  it("narrows by text through the caller's label", () => {
    const labelFor = (o: Opportunity) => (o.id === "a" ? "Ana Pérez" : "Juan Rojas");
    expect(filterDeals(deals, { query: "ana", labelFor }).map((d) => d.id)).toEqual(["a"]);
  });
});

describe("orderDeals", () => {
  const deals = [
    deal({ id: "small", expected_value_cents: 100, created_at: "2026-06-01T00:00:00Z" }),
    deal({ id: "big", expected_value_cents: 900, created_at: "2026-08-01T00:00:00Z" }),
    deal({ id: "none", expected_value_cents: null, created_at: "2026-01-01T00:00:00Z" }),
  ];

  it("puts the largest figure first", () => {
    expect(orderDeals(deals, "value").map((d) => d.id)).toEqual(["big", "small", "none"]);
  });

  it("puts the oldest first, which is the point of ordering by age", () => {
    expect(orderDeals(deals, "age").map((d) => d.id)).toEqual(["none", "small", "big"]);
  });

  it("leaves the pipeline order alone", () => {
    expect(orderDeals(deals, "stage")).toBe(deals);
  });
});

describe("comunasIn", () => {
  it("collects every comuna once, alphabetically", () => {
    const deals = [
      deal({ comunas: ["Ñuñoa", "Macul"] }),
      deal({ comunas: ["Macul"] }),
      deal({ comunas: [] }),
    ];
    expect(comunasIn(deals)).toEqual(["Macul", "Ñuñoa"]);
  });
});
