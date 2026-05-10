import type { ReactNode } from "react";
import { useGrantForProperty } from "@features/owner/hooks/use-my-grants";

interface CapGatedProps {
  cap: string;
  propertyId?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only if the current user has `cap` on the named property
 * via property_grants. When fallback is provided, renders it otherwise.
 */
export function CapGated({ cap, propertyId, fallback = null, children }: CapGatedProps) {
  const { grant } = useGrantForProperty(propertyId);
  if (!grant) return <>{fallback}</>;
  if (!grant.capabilities.includes(cap)) return <>{fallback}</>;
  return <>{children}</>;
}

export function userHasCap(caps: string[] | undefined, cap: string): boolean {
  return !!caps && caps.includes(cap);
}
