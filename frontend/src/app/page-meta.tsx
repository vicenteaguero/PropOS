import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { buildGroups, type NavGroup } from "@layouts/nav-items";
import type { UserView } from "@shared/types/auth";

const APP_NAME = "PropOS";

/** Every path the nav tree knows about, longest first so /a/b beats /a. */
function titleIndex(): Array<[string, string]> {
  const views: UserView[] = ["admin", "admin-dev", "agent", "owner", "buyer", "content"];
  const seen = new Map<string, string>();
  for (const view of views) {
    for (const group of buildGroups(view, "Propo", true) as NavGroup[]) {
      for (const item of group.items) seen.set(item.path, item.label);
    }
  }
  return [...seen.entries()].sort((a, b) => b[0].length - a[0].length);
}

const INDEX = titleIndex();

/** Nav label for a pathname, or null when no entry owns it (detail routes). */
export function titleForPath(pathname: string): string | null {
  const hit = INDEX.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return hit ? hit[1] : null;
}

const PageTitleContext = createContext<((title: string | null) => void) | null>(null);

/**
 * Names the current page in the browser tab.
 *
 * Every tab used to read "PropOS", which is worst exactly where the product is
 * strongest — the desktop broker running six views at once had six identical
 * tabs. It also gives screen readers something to announce on navigation, which
 * a client-side route change otherwise does not produce.
 *
 * Most routes need no call: the title is looked up in the shared nav tree by
 * pathname. Detail routes (`/personas/:id`) call `usePageTitle(contact.name)`
 * to name themselves.
 */
export function usePageTitle(title: string | null | undefined): void {
  const setOverride = useContext(PageTitleContext);
  useEffect(() => {
    if (!setOverride) return;
    setOverride(title ?? null);
    return () => setOverride(null);
  }, [setOverride, title]);
}

/**
 * Owns `document.title` and the per-navigation reset that a SPA has to do by
 * hand: the scroll container keeps its offset across route changes, so leaving
 * a scrolled list dropped you into the middle of the next page; and focus stays
 * on the element that was clicked, which is now unmounted, so keyboard and
 * screen-reader users get no signal that anything happened.
 */
export function PageMetaProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [override, setOverride] = useState<string | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const name = override ?? titleForPath(pathname);
    document.title = name ? `${name} · ${APP_NAME}` : APP_NAME;
  }, [pathname, override]);

  useEffect(() => {
    // Skip the initial mount: a deep link should keep the browser's own scroll
    // and focus, and stealing focus on first paint fights the login redirect.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const main = document.getElementById("main-content");
    main?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    // tabIndex -1 makes <main> programmatically focusable without adding it to
    // the tab sequence; focusing the landmark makes assistive tech announce the
    // new region, and puts the next Tab at the top of the new page.
    main?.focus({ preventScroll: true });
  }, [pathname]);

  return <PageTitleContext.Provider value={setOverride}>{children}</PageTitleContext.Provider>;
}
