import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@core/supabase/client";
import { createLogger } from "@core/logging/logger";
import type { AuthState, UserProfile, UserRole } from "@shared/types/auth";

const logger = createLogger("Auth");

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
}

const DEFAULT_AUTH_STATE: AuthContextValue = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signOut: async () => {},
};

export const AuthContext = createContext<AuthContextValue>(DEFAULT_AUTH_STATE);

interface ProfileRow {
  id: string;
  full_name: string;
  role: UserRole;
  tenant_id: string;
  is_active: boolean;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, tenant_id, is_active")
    .eq("id", userId)
    .single();

  if (error || !data) {
    logger.error("error", "Failed to fetch user profile", { userId });
    return null;
  }

  const row = data as ProfileRow;

  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    tenantId: row.tenant_id,
    isActive: row.is_active,
  };
}

export function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }

    const profile = await fetchProfile(session.user.id);
    if (profile) {
      logger.info("auth", "User authenticated", { role: profile.role });
      setState({ user: profile, isLoading: false, isAuthenticated: true });
    } else {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        handleSession(session);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSession]);

  const signOut = useCallback(async () => {
    logger.info("auth", "User signing out");
    await supabase.auth.signOut();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  return {
    ...state,
    signOut,
  };
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
