import { useEffect } from "react";
import { useAuth } from "@shared/hooks/use-auth";
import { useTenantBranding } from "@core/branding/agent-branding";
import { applyTenantAccent, clearTenantAccent } from "./tenant-accent";

/**
 * Injects the active tenant's brand accent on <html>. Uses the explicit
 * settings.brand_color when set, otherwise a hue derived from the tenant id
 * (instant from auth state, so the accent recolors the moment the workspace
 * switches). Must render inside AgentBrandingProvider. Renders nothing.
 */
export function ThemeController() {
  const { user } = useAuth();
  const { brandColor } = useTenantBranding();
  const tenantId = user?.tenantId ?? null;

  useEffect(() => {
    if (tenantId || brandColor) applyTenantAccent({ seed: tenantId, color: brandColor });
    else clearTenantAccent();
  }, [tenantId, brandColor]);

  return null;
}
