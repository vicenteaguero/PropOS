import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@core/supabase/client";
import { createLogger } from "@core/logging/logger";
import { apiRequest, getActiveTenantId, setActiveTenantId } from "@features/documents/api/http";
import type {
  AuthState,
  PropertyGrant,
  TenantMembership,
  UserProfile,
  UserRole,
  UserView,
} from "@shared/types/auth";

const logger = createLogger("Auth");

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshGrants: () => Promise<void>;
}

const DEFAULT_AUTH_STATE: AuthContextValue = {
  user: null,
  memberships: [],
  grants: [],
  isLoading: true,
  isAuthenticated: false,
  signOut: async () => {},
  switchTenant: async () => {},
  refreshGrants: async () => {},
};

export const AuthContext = createContext<AuthContextValue>(DEFAULT_AUTH_STATE);

interface ProfileRow {
  id: string;
  full_name: string;
  role: UserRole;
  tenant_id: string;
  is_active: boolean;
  avatar_url: string | null;
  admin_scope: string[] | null;
  is_dev_admin: boolean | null;
  view: UserView | null;
}

interface MembershipApiRow {
  user_id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  role: UserRole;
  admin_scope: string[];
  is_dev_admin: boolean;
  view: UserView;
  is_active: boolean;
}

interface GrantApiRow {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  view: UserView;
  capabilities: string[];
  property_title: string | null;
  property_address: string | null;
  granted_by: string | null;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, tenant_id, is_active, avatar_url, admin_scope, is_dev_admin, view",
    )
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
    avatarUrl: row.avatar_url,
    adminScope: row.admin_scope ?? [],
    isDevAdmin: !!row.is_dev_admin,
    view: row.view ?? "agent",
  };
}

async function fetchMemberships(): Promise<TenantMembership[]> {
  try {
    const rows = await apiRequest<MembershipApiRow[]>("/v1/memberships/me");
    return rows.map((r) => ({
      userId: r.user_id,
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      tenantSlug: r.tenant_slug,
      role: r.role,
      adminScope: r.admin_scope ?? [],
      isDevAdmin: r.is_dev_admin,
      view: r.view,
      isActive: r.is_active,
    }));
  } catch (err) {
    logger.error("error", "Failed to fetch memberships", { err: String(err) });
    return [];
  }
}

async function fetchGrants(): Promise<PropertyGrant[]> {
  try {
    const rows = await apiRequest<GrantApiRow[]>("/v1/grants/me");
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      propertyId: r.property_id,
      tenantId: r.tenant_id,
      view: r.view,
      capabilities: r.capabilities ?? [],
      propertyTitle: r.property_title,
      propertyAddress: r.property_address,
      grantedBy: r.granted_by,
    }));
  } catch (err) {
    logger.error("error", "Failed to fetch grants", { err: String(err) });
    return [];
  }
}

export function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    memberships: [],
    grants: [],
    isLoading: true,
    isAuthenticated: false,
  });

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState({
        user: null,
        memberships: [],
        grants: [],
        isLoading: false,
        isAuthenticated: false,
      });
      setActiveTenantId(null);
      return;
    }

    // 1) Memberships first — pick a default tenant before any tenant-scoped call.
    const memberships = await fetchMemberships();
    const stored = getActiveTenantId();
    const initialTenant =
      (stored && memberships.find((m) => m.tenantId === stored)?.tenantId) ||
      memberships[0]?.tenantId ||
      null;
    setActiveTenantId(initialTenant);

    // 2) Activate it so backend syncs profile snapshot.
    if (initialTenant) {
      try {
        await apiRequest("/v1/memberships/activate", {
          method: "POST",
          body: { tenant_id: initialTenant },
        });
      } catch (err) {
        logger.error("error", "activate_tenant failed", { err: String(err) });
      }
    }

    // 3) Profile (now reflects the active tenant snapshot) + grants.
    const [profile, grants] = await Promise.all([fetchProfile(session.user.id), fetchGrants()]);
    if (profile) {
      logger.info("auth", "User authenticated", { role: profile.role, view: profile.view });
      setState({
        user: profile,
        memberships,
        grants,
        isLoading: false,
        isAuthenticated: true,
      });
    } else {
      setState({
        user: null,
        memberships: [],
        grants: [],
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSession]);

  const signOut = useCallback(async () => {
    logger.info("auth", "User signing out");
    setActiveTenantId(null);
    await supabase.auth.signOut();
    setState({ user: null, memberships: [], grants: [], isLoading: false, isAuthenticated: false });
  }, []);

  const switchTenant = useCallback(async (tenantId: string) => {
    setActiveTenantId(tenantId);
    try {
      await apiRequest("/v1/memberships/activate", {
        method: "POST",
        body: { tenant_id: tenantId },
      });
    } catch (err) {
      logger.error("error", "switchTenant activate failed", { err: String(err) });
    }
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const [profile, grants] = await Promise.all([
        fetchProfile(data.session.user.id),
        fetchGrants(),
      ]);
      if (profile) {
        setState((prev) => ({ ...prev, user: profile, grants }));
      }
    }
  }, []);

  const refreshGrants = useCallback(async () => {
    const grants = await fetchGrants();
    setState((prev) => ({ ...prev, grants }));
  }, []);

  return {
    ...state,
    signOut,
    switchTenant,
    refreshGrants,
  };
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
