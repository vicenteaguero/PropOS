import { describe, expect, it } from "vitest";
import { buildGroups, filterByScope, type NavGroup } from "./nav-items";

const VIEWS = ["admin", "admin-dev", "agent", "owner", "buyer", "content"] as const;

function paths(groups: NavGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.path));
}

/**
 * The mobile "Más" sheet and the desktop sidebar both render `useNavGroups()`,
 * so parity is structural rather than something to assert screen-by-screen.
 * What these tests protect is the property that made parity possible: the tree
 * is data, every entry is reachable, and nothing is hardcoded per shell.
 *
 * The tree is deliberately SMALL now — the former list routes are tabs inside
 * four sections — so these assert reachability and filtering, not item count.
 */
describe("navigation tree", () => {
  it("exposes every admin section as data", () => {
    const admin = paths(buildGroups("admin-dev", "Propo", true));
    for (const path of [
      "/admin",
      "/admin/crm",
      "/admin/agenda",
      "/admin/finanzas",
      "/admin/documentos",
      // The queue that was unreachable on mobile is the canary for this fix.
      "/admin/pendientes",
    ]) {
      expect(admin).toContain(path);
    }
  });

  it("builds a non-empty tree for every view", () => {
    for (const view of VIEWS) {
      expect(paths(buildGroups(view, "Propo", false)).length, view).toBeGreaterThan(0);
    }
  });

  it("gives every item a unique path so both shells can key on it", () => {
    for (const view of VIEWS) {
      const p = paths(buildGroups(view, "Propo", true));
      expect(new Set(p).size, view).toBe(p.length);
    }
  });

  it("hides dev-only entries from non-dev admins", () => {
    expect(paths(buildGroups("admin", "Propo", false))).not.toContain("/admin/tenants");
    expect(paths(buildGroups("admin-dev", "Propo", true))).toContain("/admin/tenants");
  });

  it("treats an empty admin scope as full access, not zero access", () => {
    const all = buildGroups("admin", "Propo", false);
    expect(paths(filterByScope(all, []))).toEqual(paths(all));
  });

  it("drops groups whose every item is out of scope", () => {
    const scoped = filterByScope(buildGroups("admin", "Propo", false), ["crm"]);
    expect(scoped.every((g) => g.items.length > 0)).toBe(true);
    expect(paths(scoped)).not.toContain("/admin/finanzas");
  });

  it("keeps unscoped entries visible under any scope", () => {
    // Propiedades carries no `scope`, so a CRM-only admin must still reach it.
    expect(paths(filterByScope(buildGroups("admin", "Propo", false), ["crm"]))).toContain(
      "/admin/crm?tab=propiedades",
    );
  });
});
