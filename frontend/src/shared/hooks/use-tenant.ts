import { useMemo } from "react";
import { useAuth } from "@shared/hooks/use-auth";

interface TenantInfo {
  tenantId: string | null;
  isLoading: boolean;
}

export function useTenant(): TenantInfo {
  const { user, isLoading } = useAuth();

  return useMemo(
    () => ({
      tenantId: user?.tenantId ?? null,
      isLoading,
    }),
    [user?.tenantId, isLoading],
  );
}
