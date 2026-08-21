import { beforeEach, describe, expect, it } from "vitest";
import { bootstrapTenantAccent, cacheTenantAccent, readCachedAccent } from "./tenant-accent";

const TENANT = "dededede-0000-4000-8000-000000000001";
const OTHER = "aaaaaaaa-0000-4000-8000-000000000002";

describe("tenant accent cache", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
    delete document.documentElement.dataset.tenant;
  });

  it("replays the brand colour before the branding query answers", () => {
    // The flash this exists to kill: sign in, paint grey, repaint in brand.
    cacheTenantAccent({ seed: TENANT, color: "#0F5132", tint: 6, slug: "anaida" });
    localStorage.setItem("propos.active_tenant_id", TENANT);

    bootstrapTenantAccent();

    expect(document.documentElement.style.getPropertyValue("--accent-brand")).toBe("#0F5132");
    expect(document.documentElement.style.getPropertyValue("--tint")).toBe("6%");
    expect(document.documentElement.dataset.tenant).toBe("anaida");
  });

  it("ignores a cache belonging to a different workspace", () => {
    // Switching workspace writes the new id first; replaying the old accent
    // would open the app in the previous brokerage's colours.
    cacheTenantAccent({ seed: OTHER, color: "#0F5132", tint: 6, slug: "otra" });
    localStorage.setItem("propos.active_tenant_id", TENANT);

    bootstrapTenantAccent();

    expect(document.documentElement.style.getPropertyValue("--accent-brand")).toBe("");
    expect(document.documentElement.dataset.tenant).toBeUndefined();
    expect(readCachedAccent(TENANT)).toBeNull();
  });

  it("survives unreadable storage instead of blocking the boot", () => {
    localStorage.setItem("propos:tenant-accent", "{not json");
    localStorage.setItem("propos.active_tenant_id", TENANT);
    expect(() => bootstrapTenantAccent()).not.toThrow();
  });
});
