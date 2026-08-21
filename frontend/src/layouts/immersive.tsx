import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Lets one surface ask the phone shell to get out of the way.
 *
 * An open conversation is the case this exists for. It is a full task, not a
 * page inside a section: the broker is reading a thread and typing a reply, and
 * every strip of chrome around it costs a line of that thread. Worse, the
 * bottom nav sits under the composer, so the input floated ~50px off the bottom
 * of the screen with the home indicator and five tab labels between it and the
 * thumb sending the message.
 *
 * Both bars publish their measured height to `--app-header-h` / `--app-nav-h`,
 * which every viewport-pinned primitive subtracts — so hiding them has to
 * zero those tokens, not merely hide the pixels, or the surface keeps
 * reserving space for chrome that is no longer there.
 */
const ImmersiveContext = createContext<{
  count: number;
  claim: () => () => void;
} | null>(null);

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const claim = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => Math.max(0, n - 1));
  }, []);
  const value = useMemo(() => ({ count, claim }), [count, claim]);
  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>;
}

/** True while any mounted surface is asking for a bare screen. */
export function useIsImmersive(): boolean {
  return (useContext(ImmersiveContext)?.count ?? 0) > 0;
}

/**
 * Hold the shell open for as long as this component is mounted and `active`.
 * Releasing is automatic, so a surface cannot leave the app without chrome by
 * unmounting on a route change.
 */
export function useImmersive(active: boolean): void {
  const claim = useContext(ImmersiveContext)?.claim;
  useEffect(() => {
    if (!active || !claim) return;
    return claim();
  }, [active, claim]);
}
