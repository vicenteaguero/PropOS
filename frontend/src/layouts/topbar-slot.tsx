import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Lets a section render its tab bar inside the phone's top bar.
 *
 * The alternative — the top bar printing the page title, and the section
 * printing its tabs directly beneath — spent two full rows saying almost the
 * same thing: "Clientes" above "Conversaciones · Personas · Negocios ·
 * Propiedades", where the tab already names the view and the title only names
 * its container. On a 390px screen that pushed the first row of actual content
 * a third of the way down every list in the app.
 *
 * A DOM host rather than a React node in state: the tabs re-render on every
 * keystroke of a search field inside the section, and storing an element in
 * context state would push a new context value — and re-render the whole shell —
 * on each one. The host element is stable, so the portal costs nothing after
 * mount. `occupied` is separate and boolean, so the bar knows whether to paint
 * its own title without inspecting the DOM.
 */
interface TopbarSlot {
  host: HTMLElement | null;
  occupied: boolean;
  setHost: (el: HTMLElement | null) => void;
  claim: () => () => void;
}

const TopbarSlotContext = createContext<TopbarSlot | null>(null);

export function TopbarSlotProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);

  const claim = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo<TopbarSlot>(
    () => ({ host, occupied: claims > 0, setHost, claim }),
    [host, claims, claim],
  );
  return <TopbarSlotContext.Provider value={value}>{children}</TopbarSlotContext.Provider>;
}

/**
 * The element section tabs portal into, or null when no top bar is mounted —
 * the desktop shell has a sidebar and no such bar, so callers must render
 * their tabs in place instead. Claiming the slot for as long as the caller is
 * mounted is part of taking it.
 */
export function useTopbarSlot(): HTMLElement | null {
  const ctx = useContext(TopbarSlotContext);
  const host = ctx?.host ?? null;
  const claim = ctx?.claim;
  useEffect(() => {
    if (!host || !claim) return;
    return claim();
  }, [host, claim]);
  return host;
}

/** True while something is rendering into the slot. */
export function useTopbarSlotOccupied(): boolean {
  return useContext(TopbarSlotContext)?.occupied ?? false;
}

/** Ref callback for the top bar to claim the slot. */
export function useTopbarSlotHost(): (el: HTMLElement | null) => void {
  const ctx = useContext(TopbarSlotContext);
  return ctx?.setHost ?? noop;
}

const noop = () => {};
