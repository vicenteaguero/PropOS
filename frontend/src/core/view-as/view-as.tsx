import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@shared/hooks/use-auth";
import type { UserProfile, UserRole } from "@shared/types/auth";

export interface ViewAsTarget {
  id: string;
  fullName: string;
  role: UserRole;
  adminScope?: string[];
}

interface ViewAsState {
  target: ViewAsTarget | null;
  start: (target: ViewAsTarget) => void;
  exit: () => void;
}

const STORAGE_KEY = "propos:viewAs";

function load(): ViewAsTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ViewAsTarget) : null;
  } catch {
    return null;
  }
}

function save(target: ViewAsTarget | null): void {
  if (typeof window === "undefined") return;
  if (target) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
  else window.localStorage.removeItem(STORAGE_KEY);
}

const ViewAsContext = createContext<ViewAsState>({
  target: null,
  start: () => {},
  exit: () => {},
});

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ViewAsTarget | null>(() => load());

  const start = useCallback((t: ViewAsTarget) => {
    setTarget(t);
    save(t);
  }, []);

  const exit = useCallback(() => {
    setTarget(null);
    save(null);
  }, []);

  const value = useMemo<ViewAsState>(() => ({ target, start, exit }), [target, start, exit]);

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAs(): ViewAsState {
  return useContext(ViewAsContext);
}

/**
 * Returns the user shape the UI should render as. When admin has activated
 * "Ver como…", returns the impersonation target with that role; otherwise
 * the real authenticated user.
 *
 * Note: this is purely UI-side. RLS/data fetches still run as the admin's
 * real auth.uid() — admins typically have full tenant access already, so
 * the view-as is a navigation/UI test, not a security boundary.
 */
export function useEffectiveUser(): UserProfile | null {
  const { user } = useAuth();
  const { target } = useViewAs();
  if (!user) return null;
  if (!target || user.role !== "ADMIN") return user;
  return {
    ...user,
    id: target.id,
    fullName: target.fullName,
    role: target.role,
    adminScope: target.adminScope ?? [],
  };
}
