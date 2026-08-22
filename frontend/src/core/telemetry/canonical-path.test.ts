import { describe, expect, it } from "vitest";
import { canonicalPath } from "./canonical-path";

/**
 * The whole point of canonicalising is that a telemetry key must never carry a
 * customer's id. `usage_events` has no SELECT policy for `authenticated`, but a
 * key like `/admin/personas/8f0c…` would still put "this brokerage talked to
 * this person" into a table built for counting screens.
 */
describe("canonicalPath", () => {
  it("replaces a uuid with :id", () => {
    expect(canonicalPath("/admin/personas/a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "/admin/personas/:id",
    );
  });

  it("replaces a numeric id", () => {
    expect(canonicalPath("/admin/documents/4821")).toBe("/admin/documents/:id");
  });

  it("replaces every id in a nested path", () => {
    expect(canonicalPath("/admin/timeline/properties/a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "/admin/timeline/properties/:id",
    );
  });

  it("is case insensitive about hex", () => {
    expect(canonicalPath("/admin/personas/A1B2C3D4-E5F6-7890-ABCD-EF1234567890")).toBe(
      "/admin/personas/:id",
    );
  });

  it("leaves a plain route alone", () => {
    expect(canonicalPath("/admin/clientes")).toBe("/admin/clientes");
    expect(canonicalPath("/")).toBe("/");
  });

  it("does not mistake a word for an id", () => {
    // `propiedades` is hex-ish in nobody's world, but `deadbeef` is -- and a
    // naive /^[0-9a-f]+$/ would eat route segments like `documents`.
    expect(canonicalPath("/admin/propiedades")).toBe("/admin/propiedades");
    expect(canonicalPath("/admin/settings/clientes")).toBe("/admin/settings/clientes");
  });
});
