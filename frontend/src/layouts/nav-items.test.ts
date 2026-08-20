import { describe, expect, it } from "vitest";
import {
  buildGroups,
  buildSettingsShortcuts,
  filterByDev,
  filterByScope,
  SETTINGS_PATH,
  type NavGroup,
} from "./nav-items";

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
      "/admin/clientes",
      "/admin/agenda",
      "/admin/finanzas",
      "/admin/documentos",
      // The queue that was unreachable on mobile is the canary for this fix.
      "/admin/pendientes",
      // Configuración used to be hardcoded in each shell's chrome, so neither
      // shell could tell it existed. It is a real entry now.
      SETTINGS_PATH,
    ]) {
      expect(admin).toContain(path);
    }
  });

  /**
   * The once-a-month destinations moved behind Configuración. Demoting them is
   * only acceptable while they stay REACHABLE, so assert both halves: gone from
   * the tree, present in the settings shortcuts.
   */
  it("keeps every demoted destination reachable through Configuración", () => {
    const admin = paths(buildGroups("admin-dev", "Propo", true));
    const shortcuts = buildSettingsShortcuts("Propo").map((i) => i.path);
    for (const path of [
      "/admin/users",
      "/admin/visitantes",
      "/admin/phones",
      "/admin/datos/importar",
      "/admin/workflows",
      "/admin/tenants",
    ]) {
      expect(admin, path).not.toContain(path);
      expect(shortcuts, path).toContain(path);
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
    const forDev = (isDev: boolean) =>
      filterByDev([{ items: buildSettingsShortcuts("Propo") }], isDev).flatMap((g) =>
        g.items.map((i) => i.path),
      );
    expect(forDev(false)).not.toContain("/admin/tenants");
    expect(forDev(true)).toContain("/admin/tenants");
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
      "/admin/clientes?tab=propiedades",
    );
  });
});
