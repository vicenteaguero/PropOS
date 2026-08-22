import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, Building2, Check, Search } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { apiRequest } from "@shared/api/http";
import { tenantSwatch } from "@core/theme/tenant-accent";
import { UfButton } from "@features/uf/components/uf-button";
import { BottomSheet, WorkspacePill } from "@shared/ui";
import {
  CommandPalette,
  useCommandPaletteHotkey,
} from "@shared/components/command-palette/command-palette";
import { useCurrentPageTitle } from "@app/page-meta";
import { useTopbarHosts, useTopbarSearchOwned, useTopbarSlotOccupied } from "@layouts/topbar-slot";
import { useIsImmersive } from "@layouts/immersive";
import type { UserView } from "@shared/types/auth";
import { cn } from "@/lib/utils";

/**
 * ONE control height for the whole app chrome.
 *
 * The PWA top row used to stack three: a 44px WorkspacePill, a UF chip painted
 * at 28px inside a 44px hit box, and a 40px bell — three optical sizes on a row
 * 12px tall. 36px is the dense desktop size; on a finger-driven pointer it
 * grows to the 44px WCAG/HIG floor, so there is still a single rule rather than
 * a per-control decision.
 */
export const HEADER_CONTROL = "h-9 [@media(pointer:coarse)]:h-11";
/** Square variant, for the round icon controls on the same row. */
export const HEADER_CONTROL_SQUARE = "size-9 [@media(pointer:coarse)]:size-11";

/**
 * Publishes the bar's rendered height to `--app-header-h`.
 *
 * The mobile shell used to hardcode `--app-header-h: 0px` because it genuinely
 * had no header. Now that it has one, every viewport-pinned primitive
 * (MasterDetail, AppShellScroll, PageLayout) must subtract the real number, and
 * the real number is not a constant: the bar carries `--safe-top`, which is 0
 * in a browser tab and ~59px under a Dynamic Island. Measuring is the only way
 * both shells can share the same token honestly.
 */
function usePublishHeaderHeight(ref: React.RefObject<HTMLElement | null>, hidden: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    // See the same guard in MobileBottomNav: hidden must publish 0, not the
    // last height, or every pinned surface keeps a gap where the bar was.
    if (hidden) {
      root.style.setProperty("--app-header-h", "0px");
      return;
    }
    const el = ref.current;
    if (!el) return;
    const publish = () => root.style.setProperty("--app-header-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      // Back to the :root default (3.5rem), which is the sidebar shell's header.
      root.style.removeProperty("--app-header-h");
    };
  }, [ref, hidden]);
}

/** Pendientes count, kept local so the bar works on every page, not just Inicio. */
function usePendingBadge(enabled: boolean): number {
  const query = useQuery<{ pending_count: number }>({
    queryKey: ["analytics", "pending-count"],
    queryFn: () => apiRequest("/v1/analytics/pending-count"),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled,
  });
  return query.data?.pending_count ?? 0;
}

/**
 * The phone shell's top bar. Sticky, so the workspace the broker is acting on
 * and the pendientes count never scroll away — before this the row lived inside
 * the home page, which meant every other screen lost both.
 */
/**
 * Section roots: the destinations the bottom nav and the "Más" sheet can reach
 * directly. Everything deeper than one of these was arrived at by tapping
 * something, so it gets a back control — which is how a phone app is expected to
 * behave and how this one did not: several screens (Pendientes among them, the
 * one a push notification opens) had no way out but the OS gesture.
 */
const SECTION_ROOTS = ["", "clientes", "agenda", "finanzas", "documentos", "settings"];

function isSectionRoot(pathname: string, base: string): boolean {
  if (pathname === base) return true;
  const rest = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : null;
  return rest !== null && SECTION_ROOTS.includes(rest);
}

export function MobileTopBar() {
  const { user, memberships, switchTenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  // The page's own name, override included — `titleForPath` only knows the nav
  // tree, so a contact's page was labelled "Personas" and a property's had no
  // label at all (`/propiedades/:id` is not a nav path). Detail routes name
  // themselves through usePageTitle; this is the same value the browser tab
  // shows.
  const pageTitle = useCurrentPageTitle() ?? "";
  const { setTabsHost, setActionsHost } = useTopbarHosts();
  const tabsInBar = useTopbarSlotOccupied();
  // A page with its own search field takes the magnifier's place with its
  // primary action. See useTopbarOwnsSearch.
  const pageOwnsSearch = useTopbarSearchOwned();
  const [wsOpen, setWsOpen] = useState(false);
  // The palette lives here rather than beside the shell so that the one visible
  // trigger and the surface it opens share state. On a phone ⌘K and `/` are not
  // reachable, so without a button the palette simply did not exist — the
  // fastest route to any record in the product, missing on the form factor the
  // product is built for.
  const [paletteOpen, setPaletteOpen] = useCommandPaletteHotkey();
  const barRef = useRef<HTMLElement>(null);
  const immersive = useIsImmersive();
  usePublishHeaderHeight(barRef, immersive);

  const view = (user?.view as UserView | undefined) ?? "agent";
  const scope = user?.adminScope ?? [];
  const allow = (s?: string) => !s || scope.length === 0 || scope.includes(s);
  const canPendientes =
    allow("pendientes") && (view === "admin" || view === "admin-dev" || view === "agent");
  const pendingCount = usePendingBadge(canPendientes);

  if (!user) return null;
  // An open conversation owns the whole screen (see useImmersive).
  if (immersive) return null;

  const base = `/${user.role.toLowerCase()}`;
  const tenantName =
    memberships.find((m) => m.tenantId === user.tenantId)?.tenantName ?? "Workspace";
  // Home is the role root exactly — every deeper route names itself instead.
  const isHome = pathname === base;
  const canGoBack = !isSectionRoot(pathname, base);
  // `location.key === "default"` is React Router's marker for the first entry of
  // the session: a cold-opened deep link has nothing to pop, so back means "up".
  const goBack = () =>
    location.key === "default" ? navigate(base, { replace: true }) : navigate(-1);

  return (
    <>
      <header
        ref={barRef}
        className="sticky top-0 z-40 bg-background/85 pt-[var(--safe-top)] backdrop-blur-md"
      >
        {/* Workspace, UF and notifications are HOME chrome, not app chrome.
            Carrying them on every screen spent the top of a phone on three
            controls a broker touches once a day, above a section tab bar and a
            page header — so a list started a third of the way down. Everywhere
            else the bar collapses to the page's own title, set by PageMeta. */}
        <div className="flex items-center gap-1.5 px-[var(--page-x)] py-2">
          {canGoBack && (
            <button
              type="button"
              aria-label="Volver"
              onClick={goBack}
              className={cn(
                "-ml-2 flex shrink-0 items-center justify-center rounded-full text-foreground transition active:scale-90 active:bg-secondary",
                HEADER_CONTROL_SQUARE,
              )}
            >
              <ArrowLeft className="size-5" strokeWidth={1.9} />
            </button>
          )}
          {isHome && (
            <WorkspacePill
              label={tenantName}
              onClick={() => setWsOpen(true)}
              className={cn(HEADER_CONTROL, "py-0")}
            />
          )}
          {/* A section's tabs land here through a portal, and when they do they
              ARE the title: the tab names the view, while the container's name
              ("Clientes" over "Conversaciones") adds nothing a second row of
              chrome is worth. The title paints only when the slot is empty. */}
          <div
            ref={setTabsHost}
            className={cn("min-w-0 items-center", tabsInBar ? "flex flex-1" : "hidden")}
          />
          {!isHome && !tabsInBar && (
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-foreground">
              {pageTitle}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* The page's primary action, portalled in. It lands where the
                magnifier used to be — the most reachable corner of the screen —
                on exactly the pages that have their own search field. */}
            <div ref={setActionsHost} className="flex shrink-0 items-center gap-1.5 empty:hidden" />
            {/* Deliberately NOT gated on `isHome`, unlike everything beside it:
                Workspace, UF and the bell are home chrome, while search is the
                one control whose whole value is being reachable from wherever
                the broker already is. It IS gated on the page not having its
                own search, because two search affordances one above the other
                is a question about which one searches what. */}
            {!pageOwnsSearch && (
              <button
                type="button"
                aria-label="Buscar"
                onClick={() => setPaletteOpen(true)}
                className={cn(
                  "flex items-center justify-center rounded-full bg-secondary text-foreground transition active:scale-90",
                  HEADER_CONTROL_SQUARE,
                )}
              >
                <Search className="size-[18px]" strokeWidth={1.9} />
              </button>
            )}
            {/* UfButton belongs to the UF feature; sizing it from the outside
                keeps this row's single height rule without reaching into it. */}
            {isHome && (
              <div className="flex items-center [&>button]:h-9 [@media(pointer:coarse)]:[&>button]:h-11">
                <UfButton />
              </div>
            )}
            {isHome && canPendientes && (
              <button
                type="button"
                aria-label={pendingCount > 0 ? `Pendientes (${pendingCount})` : "Pendientes"}
                onClick={() => navigate(`${base}/pendientes`)}
                className={cn(
                  "relative flex items-center justify-center rounded-full bg-secondary text-foreground transition active:scale-90",
                  HEADER_CONTROL_SQUARE,
                )}
              >
                <Bell className="size-[18px]" strokeWidth={1.9} />
                {pendingCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-[18px] text-destructive-foreground">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <BottomSheet open={wsOpen} onOpenChange={setWsOpen} title="Espacio de trabajo">
        <div className="mt-3">
          {memberships.map((m) => {
            const active = m.tenantId === user.tenantId;
            return (
              <button
                key={m.tenantId}
                type="button"
                onClick={() => {
                  if (!active) void switchTenant(m.tenantId);
                  setWsOpen(false);
                }}
                className={cn(
                  "mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99]",
                  active ? "border-foreground" : "border-border",
                )}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: tenantSwatch(m.tenantId) }}
                >
                  <Building2 className="size-4 text-white" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold tracking-tight text-foreground">
                    {m.tenantName ?? m.tenantSlug ?? m.tenantId}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {m.role.toLowerCase()}
                  </span>
                </span>
                {active && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-foreground">
                    <Check className="size-3 text-background" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
