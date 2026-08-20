import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AgentOverlay } from "./agent-overlay";

type Mode = "voice" | "chat";

interface AgentOverlayApi {
  /** True while Propo covers the screen. Chrome (the bottom nav) hides on this. */
  isOpen: boolean;
  open: (mode?: Mode) => void;
  close: () => void;
}

const AgentOverlayContext = createContext<AgentOverlayApi | null>(null);

/**
 * Single host for the Propo overlay.
 *
 * Every entry point (home, the nav FAB, the command palette, calendar, notes)
 * used to keep its own `open` boolean and mount its own <AgentOverlay/>. Two of
 * them could be open at once, each holding a live agent session and stream, and
 * the one mounted inside <main> lost the z-index tie against the bottom nav —
 * which is why the nav sometimes sat on top of a "full-screen" Propo. One state
 * and one portalled mount removes both failure modes by construction.
 */
export function AgentOverlayProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);

  const open = useCallback((m: Mode = "chat") => setMode(m), []);
  const close = useCallback(() => setMode(null), []);

  const api = useMemo<AgentOverlayApi>(
    () => ({ isOpen: mode !== null, open, close }),
    [mode, open, close],
  );

  return (
    <AgentOverlayContext.Provider value={api}>
      {children}
      {mode !== null &&
        createPortal(<AgentOverlay onClose={close} initialMode={mode} />, document.body)}
    </AgentOverlayContext.Provider>
  );
}

/**
 * Entry points call `open()`. Outside the provider it degrades to a no-op so a
 * page rendered in isolation (tests, the public share routes) still mounts.
 */
export function useAgentOverlay(): AgentOverlayApi {
  return useContext(AgentOverlayContext) ?? NOOP;
}

const NOOP: AgentOverlayApi = { isOpen: false, open: () => {}, close: () => {} };
