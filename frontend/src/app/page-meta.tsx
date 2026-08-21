import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { buildGroups, type NavGroup } from "@layouts/nav-items";
import type { UserView } from "@shared/types/auth";

const APP_NAME = "PropOS";

interface TitleEntry {
  path: string;
  label: string;
  /** Exact-match only. Mirrors NavItem.end — the role roots use it. */
  end: boolean;
}

/**
 * Detail routes the nav deliberately does not list.
 *
 * Since the list pages became tabs, `/admin/personas` is a redirect rather than
 * a nav entry — but `/admin/personas/:id` is still a real page and still needs
 * a tab title. These fill that gap for each role that owns the routes.
 */
const DETAIL_TITLES: ReadonlyArray<readonly [string, string]> = [
  ["personas", "Personas"],
  ["properties", "Propiedades"],
  ["documents", "Documentos"],
  ["users", "Usuarios"],
  ["timeline", "Actividad"],
];

/** Every path the nav tree knows about, longest first so /a/b beats /a. */
function titleIndex(): TitleEntry[] {
  const views: UserView[] = ["admin", "admin-dev", "agent", "owner", "buyer", "content"];
  const seen = new Map<string, TitleEntry>();
  for (const view of views) {
    for (const group of buildGroups(view, "Propo", true) as NavGroup[]) {
      for (const item of group.items) {
        // A nav entry may point at a tab (`/admin/clientes?tab=propiedades`); the
        // title index is keyed by pathname, and the first entry for a pathname
        // wins so the section keeps its own name rather than a tab's.
        const path = item.path.split("?")[0] ?? item.path;
        if (!seen.has(path)) {
          seen.set(path, { path, label: item.label, end: !!item.end });
        }
      }
    }
  }
  for (const role of ["admin", "agent"]) {
    for (const [segment, label] of DETAIL_TITLES) {
      const path = `/${role}/${segment}`;
      if (!seen.has(path)) seen.set(path, { path, label, end: false });
    }
  }
  return [...seen.values()].sort((a, b) => b.path.length - a.path.length);
}

const INDEX = titleIndex();

/**
 * Nav label for a pathname, or null when no entry owns it.
 *
 * Prefix matching is deliberate so `/admin/personas/:id` inherits "Personas",
 * but entries flagged `end` match exactly — without that, every unlisted route
 * under `/admin` inherited the root's "Inicio", which is how `/admin/settings`
 * came out titled "Inicio".
 */
export function titleForPath(pathname: string): string | null {
  const hit = INDEX.find((e) =>
    e.end ? pathname === e.path : pathname === e.path || pathname.startsWith(`${e.path}/`),
  );
  return hit ? hit.label : null;
}

const PageTitleContext = createContext<((title: string | null) => void) | null>(null);

/**
 * The name of the current page, override included.
 *
 * The phone top bar used to call `titleForPath` directly, which only knows the
 * nav tree — so a contact's page was labelled "Personas" while the page under
 * it showed the person's name, and the bar named the section the user had left
 * rather than the record they were looking at.
 */
const PageTitleValueContext = createContext<string | null>(null);

export function useCurrentPageTitle(): string | null {
  return useContext(PageTitleValueContext);
}

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

  return (
    <PageTitleContext.Provider value={setOverride}>
      <PageTitleValueContext.Provider value={override ?? titleForPath(pathname)}>
        {children}
      </PageTitleValueContext.Provider>
    </PageTitleContext.Provider>
  );
}
