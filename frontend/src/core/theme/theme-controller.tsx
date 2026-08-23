import { useEffect } from "react";
import { useAuth } from "@shared/hooks/use-auth";
import { useTenantBranding } from "@core/branding/agent-branding";
import { AUTO_PALETTE, getStoredPalette, setPalette } from "./palette";
import {
  applyTenantAccent,
  cacheTenantAccent,
  clearTenantAccent,
  readCachedAccent,
} from "./tenant-accent";

/**
 * Injects the active tenant's brand accent on <html>. Uses the explicit
 * settings.brand_color when set, otherwise a hue derived from the tenant id
 * (instant from auth state, so the accent recolors the moment the workspace
 * switches). Must render inside AgentBrandingProvider. Renders nothing.
 */
export function ThemeController() {
  const { user, memberships } = useAuth();
  const { brandColor, brandTint, slug: brandedSlug, resolved } = useTenantBranding();
  const tenantId = user?.tenantId ?? null;
  // Derive the workspace slug from the auth membership (updates instantly on
  // switch) rather than the /tenants/me query (which lags behind its staleTime
  // until refetch), so the curated [data-tenant] palette swaps the moment the
  // workspace changes — not ~20s later.
  const slug = memberships.find((m) => m.tenantId === tenantId)?.tenantSlug ?? null;

  useEffect(() => {
    if (!tenantId && !brandColor) {
      clearTenantAccent();
      return;
    }
    // Until /v1/tenants/me answers, `brandColor` and `brandTint` are null — not
    // "this tenant has no brand colour", just "we have not asked yet". Applying
    // them would drop a signed-in user from their brokerage's palette to the
    // hashed hue for one round trip, which is the flash the cache exists to
    // prevent. Prefer what we already know about this exact workspace.
    const cached = resolved ? null : readCachedAccent(tenantId);
    applyTenantAccent(cached ?? { seed: tenantId, color: brandColor, tint: brandTint });
  }, [tenantId, brandColor, brandTint, resolved]);

  // Remember it for the next boot, so the app opens in the brokerage's colours
  // instead of repainting once the branding query lands. Only once the query has
  // actually answered: caching the defaults would poison the replay with grey.
  useEffect(() => {
    if (!resolved || !tenantId) return;
    cacheTenantAccent({
      seed: tenantId,
      color: brandColor,
      tint: brandTint,
      slug: brandedSlug ?? slug,
    });
  }, [resolved, tenantId, brandColor, brandTint, brandedSlug, slug]);

  // The user's own palette, replayed from the profile row.
  //
  // localStorage already painted it before the first frame; this is what makes
  // the choice follow the person to another phone. The server value wins on
  // purpose: it is the last pick this user actually saved, and the picker
  // writes both at once, so the two only disagree while a PATCH is in flight or
  // after one failed — in which case the truth is the server's.
  const remotePalette = user?.preferences?.palette;
  useEffect(() => {
    if (!user) return;
    const next = typeof remotePalette === "string" ? remotePalette : AUTO_PALETTE;
    if (next !== getStoredPalette()) setPalette(next);
  }, [user, remotePalette]);

  // Marks the active workspace on <html> for debugging and screenshots. It used
  // to select a curated [data-tenant] CSS block; those are gone (see index.css)
  // now that every colour goes through the palette tokens.
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
