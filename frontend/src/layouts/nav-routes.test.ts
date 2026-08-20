import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildGroups, type NavGroup } from "./nav-items";
import type { UserView } from "@shared/types/auth";

/** Every `path="…"` declared in the router, as a flat set. */
function routerPaths(): Set<string> {
  // cwd, not import.meta.url: the suite runs under jsdom, where import.meta.url
  // is an http:// URL and readFileSync rejects it.
  const src = readFileSync(join(process.cwd(), "src/app/router.tsx"), "utf8");
  return new Set([...src.matchAll(/path="([^"]+)"/g)].map((m) => m[1] as string));
}

/** Nav entries carry `?tab=`; a route never does. */
function pathname(navPath: string): string {
  return navPath.split("?")[0] ?? navPath;
}

const VIEWS: UserView[] = ["admin", "admin-dev", "agent", "owner", "buyer", "content"];

/**
 * A nav item that points at a route nobody declared is a dead end the user only
 * discovers by tapping it. This has bitten twice already — once when the list
 * pages became section tabs, and again when the admin group moved behind
 * Configuración — so it is worth a test rather than a convention.
 */
describe("navigation destinations", () => {
  const routes = routerPaths();

  it("every nav path resolves to a declared route", () => {
    const missing: string[] = [];
    for (const view of VIEWS) {
      for (const group of buildGroups(view, "Propo", true) as NavGroup[]) {
        for (const item of group.items) {
          const p = pathname(item.path);
          // Role roots ("/admin") are the parent route's own path, declared as
          // `/${role.toLowerCase()}` and matched with an index route.
          if (/^\/[a-z-]+$/.test(p)) continue;
          const child = p.replace(/^\/[a-z-]+\//, "");
          if (!routes.has(child)) missing.push(`${view}: ${item.label} → ${item.path}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives every item a unique destination per view", () => {
    for (const view of VIEWS) {
      const paths = (buildGroups(view, "Propo", true) as NavGroup[]).flatMap((g) =>
        g.items.map((i) => i.path),
      );
      expect(new Set(paths).size, view).toBe(paths.length);
    }
  });
});
