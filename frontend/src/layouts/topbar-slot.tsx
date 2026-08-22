import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Lets a page put its own chrome inside the phone's top bar.
 *
 * Two things travel through here.
 *
 * **Tabs.** A section's tab strip renders in the bar rather than under it. The
 * alternative spent two rows saying almost the same thing — "Clientes" above
 * "Conversaciones · Negocios", where the tab already names the view and the
 * title only names its container — which on a 390px screen pushed the first row
 * of real content a third of the way down every list in the app.
 *
 * **The primary action, and the search it displaces.** Seven surfaces used to
 * show two search affordances at once: the command-palette magnifier in the bar
 * and the page's own field directly beneath it. A page that has its own search
 * says so (`useTopbarOwnsSearch`), the bar drops the magnifier, and the page's
 * primary action — new conversation, new deal — takes the most reachable spot
 * on the screen instead. The palette stays on Inicio, on detail pages, and on
 * ⌘K.
 *
 * DOM hosts rather than React nodes in state: the tabs and the action re-render
 * on every keystroke of a search field inside the section, and storing elements
 * in context state would push a new context value — and re-render the whole
 * shell — on each one. The hosts are stable, so the portals cost nothing after
 * mount. The booleans are separate and cheap, so the bar knows whether to paint
 * its own title and its own magnifier without inspecting the DOM.
 */
interface TopbarSlots {
  tabsHost: HTMLElement | null;
  actionsHost: HTMLElement | null;
  setTabsHost: (el: HTMLElement | null) => void;
  setActionsHost: (el: HTMLElement | null) => void;
  tabsOccupied: boolean;
  searchOwned: boolean;
  claimTabs: () => () => void;
  claimSearch: () => () => void;
}

const TopbarSlotContext = createContext<TopbarSlots | null>(null);

/** A counter plus its claim function, so nested//remounting callers compose. */
function useClaimCounter() {
  const [count, setCount] = useState(0);
  const claim = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => Math.max(0, n - 1));
  }, []);
  return [count > 0, claim] as const;
}

export function TopbarSlotProvider({ children }: { children: ReactNode }) {
  const [tabsHost, setTabsHost] = useState<HTMLElement | null>(null);
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);
  const [tabsOccupied, claimTabs] = useClaimCounter();
  const [searchOwned, claimSearch] = useClaimCounter();

  const value = useMemo<TopbarSlots>(
    () => ({
      tabsHost,
      actionsHost,
      setTabsHost,
      setActionsHost,
      tabsOccupied,
      searchOwned,
      claimTabs,
      claimSearch,
    }),
    [tabsHost, actionsHost, tabsOccupied, searchOwned, claimTabs, claimSearch],
  );
  return <TopbarSlotContext.Provider value={value}>{children}</TopbarSlotContext.Provider>;
}

/**
 * The element a section's tabs portal into, or null when no top bar is mounted —
 * the desktop shell has a sidebar and no such bar, so callers must render their
 * tabs in place instead. Claiming the slot for as long as the caller is mounted
 * is part of taking it.
 *
 * `useLayoutEffect`, not `useEffect`: the claim decides whether the bar paints
 * its own title, and with a passive effect there was one committed frame where
 * neither knew, so entering Clientes flashed the tab strip in the page before it
 * jumped into the bar.
 */
export function useTopbarSlot(): HTMLElement | null {
  const ctx = useContext(TopbarSlotContext);
  const host = ctx?.tabsHost ?? null;
  const claim = ctx?.claimTabs;
  useLayoutEffect(() => {
    if (!host || !claim) return;
    return claim();
  }, [host, claim]);
  return host;
}

/** The element a page's primary action portals into. Same contract as tabs. */
export function useTopbarActionsSlot(): HTMLElement | null {
  const ctx = useContext(TopbarSlotContext);
  return ctx?.actionsHost ?? null;
}

/**
 * Declare that this page carries its own search field, so the bar drops the
 * command-palette magnifier while it is mounted.
 */
export function useTopbarOwnsSearch(active: boolean): void {
  const claim = useContext(TopbarSlotContext)?.claimSearch;
  useLayoutEffect(() => {
    if (!active || !claim) return;
    return claim();
  }, [active, claim]);
}

/** True while something is rendering tabs into the bar. */
export function useTopbarSlotOccupied(): boolean {
  return useContext(TopbarSlotContext)?.tabsOccupied ?? false;
}

/** True while a mounted page owns the search. */
export function useTopbarSearchOwned(): boolean {
  return useContext(TopbarSlotContext)?.searchOwned ?? false;
}

/** Ref callbacks for the top bar to claim its two hosts. */
export function useTopbarHosts(): {
  setTabsHost: (el: HTMLElement | null) => void;
  setActionsHost: (el: HTMLElement | null) => void;
} {
  const ctx = useContext(TopbarSlotContext);
  return {
    setTabsHost: ctx?.setTabsHost ?? noop,
    setActionsHost: ctx?.setActionsHost ?? noop,
  };
}

const noop = () => {};
