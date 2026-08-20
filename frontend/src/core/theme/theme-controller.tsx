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
  const { user, memberships } = useAuth();
  const { brandColor, brandTint } = useTenantBranding();
  const tenantId = user?.tenantId ?? null;
  // Derive the workspace slug from the auth membership (updates instantly on
  // switch) rather than the /tenants/me query (which lags behind its staleTime
  // until refetch), so the curated [data-tenant] palette swaps the moment the
  // workspace changes — not ~20s later.
  const slug = memberships.find((m) => m.tenantId === tenantId)?.tenantSlug ?? null;

  useEffect(() => {
    if (tenantId || brandColor) {
      applyTenantAccent({ seed: tenantId, color: brandColor, tint: brandTint });
    } else {
      clearTenantAccent();
    }
  }, [tenantId, brandColor, brandTint]);

  // Curated per-workspace palette (mockup parity): a [data-tenant="<slug>"] CSS
  // block in index.css restyles every surface for tenants that have one;
  // tenants without a block fall back to the neutral default + brand accent.
  useEffect(() => {
    const el = document.documentElement;
    if (slug) el.dataset.tenant = slug;
    else delete el.dataset.tenant;
    return () => {
      delete el.dataset.tenant;
    };
  }, [slug]);

  return null;
}
