import { useCallback, useEffect, useState } from "react";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Check, Loader2, LogOut, Moon, Sun } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "@layouts/app-sidebar";
import { MobileBottomNav } from "@layouts/mobile-bottom-nav";
import { MobileTopBar, HEADER_CONTROL, HEADER_CONTROL_SQUARE } from "@layouts/app-topbar";
import { TopbarSlotProvider } from "@layouts/topbar-slot";
import { ImmersiveProvider } from "@layouts/immersive";
import { SidebarWidthProbe } from "@layouts/sidebar-width-probe";
import { useNavGroups } from "@layouts/use-nav-groups";
import { CommandBar } from "@shared/components/command-bar/command-bar";
import { useAuth } from "@shared/hooks/use-auth";
import { useShellMode } from "@shared/hooks/use-shell-mode";
import { useKeyboardInset } from "@shared/hooks/use-keyboard-inset";
import { useThemeMode } from "@core/theme/theme-provider";
import { tenantSwatch } from "@core/theme/tenant-accent";
import { AgentFAB } from "@features/agent/components/agent-fab";
import { AgentOverlayProvider } from "@features/agent/components/agent-overlay-host";
import { InstallNudge } from "@shared/components/install-nudge/install-nudge";
import { useUfDailyRefresh } from "@features/uf/hooks/use-uf";
import { UfButton } from "@features/uf/components/uf-button";
import { PageSkeleton, WorkspacePill } from "@shared/ui";
import { BuildStampRow } from "@core/version/build-stamp-row";
import { initials } from "@shared/utils/format";
import { cn } from "@/lib/utils";

/** Top-bar workspace selector (always visible). Dropdown when >1 membership. */
function HeaderWorkspaceSwitcher() {
  const { memberships, user, switchTenant } = useAuth();
  if (!user) return null;
  const current = memberships.find((m) => m.tenantId === user.tenantId);
  const label = current?.tenantName ?? current?.tenantSlug ?? "Workspace";

  if (memberships.length <= 1) {
    return (
      <WorkspacePill
        label={label}
        className={cn(HEADER_CONTROL, "cursor-default py-0 active:scale-100")}
      />
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <WorkspacePill label={label} className={cn(HEADER_CONTROL, "py-0")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        {memberships.map((m) => {
          const active = m.tenantId === user.tenantId;
          return (
            <DropdownMenuItem
              key={m.tenantId}
              onSelect={() => {
                if (!active) void switchTenant(m.tenantId);
              }}
              className="flex items-center gap-2.5"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: tenantSwatch(m.tenantId) }}
              />
              <span className="flex-1 truncate">{m.tenantName ?? m.tenantSlug ?? m.tenantId}</span>
              {active && <Check className="size-3.5 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Top-bar light/dark toggle (round icon button on the right). */
function HeaderThemeToggle() {
  const { theme, toggle } = useThemeMode();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a claro" : "Cambiar a oscuro"}
      className={cn(
        "flex items-center justify-center rounded-full text-foreground transition hover:bg-secondary active:scale-90",
        HEADER_CONTROL_SQUARE,
      )}
    >
      {isDark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
    </button>
  );
}

/**
 * First thing in the tab order, visible only once focused. Without it a
 * keyboard user pays the entire sidebar — up to 24 links — on every page.
 */
function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
    >
      Saltar al contenido
    </a>
  );
}

/**
 * Held while a workspace switch is in flight. The switch clears the whole query
 * cache, so without this the app flashes every screen's empty state on the way
 * to the new tenant's data.
 */
function TenantSwitchGate() {
  const { isSwitchingTenant } = useAuth();
  if (!isSwitchingTenant) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
    >
      <Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.8} />
      <p className="text-sm text-muted-foreground">Cambiando de espacio de trabajo…</p>
    </div>
  );
}

/**
 * The lazy-route boundary, INSIDE the shell.
 *
 * It used to sit outside `<Routes>` in the router, so a navigation to a chunk
 * that was not in memory suspended the entire tree: the sidebar, the header and
 * the bottom nav all unmounted, a full-screen home-shaped skeleton took their
 * place, and then the whole shell was rebuilt. That is why moving between
 * sections felt like a page load in 2009 rather than a tab switch — the latency
 * was real, but most of what it *felt* like was the chrome disappearing.
 *
 * Here the shell stays mounted and only the content area waits. `PageSkeleton`
 * rather than `AppSkeleton` for the same reason: the placeholder should look
 * like where you are going.
 */
function RouteSuspense() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" className="px-[var(--page-x)] py-4" />}>
      <Outlet />
    </Suspense>
  );
}

export function AppLayout() {
  const { user, signOut } = useAuth();
  const shellMode = useShellMode();
  useUfDailyRefresh();
  // Held for the lifetime of the app, in BOTH shell branches, so the viewport
  // store's refcount never reaches zero and its four CSS variables are never
  // torn down while a surface is still using them. It also seeds `restHeight`
  // at boot — before any input exists that could open a keyboard — which is
  // what stops a surface mounting mid-keyboard from measuring a shrunken page
  // as if it were the resting height.
  useKeyboardInset();

  const { groups } = useNavGroups();
  const navLabels = groups.flatMap((g) => g.items.map((i) => i.label));
  const [navWidth, setNavWidth] = useState<number | null>(null);
  // Guarded so a measurement that agrees with the current state cannot start a
  // render loop through the probe's layout effect.
  const setNavWidthIfChanged = useCallback(
    (px: number) => setNavWidth((prev) => (prev === px ? prev : px)),
    [],
  );

  // Sidebar auto-collapses to the icon rail on narrow desktops and expands on
  // wide ones, with HYSTERESIS: collapse below 1180px, expand above 1300px, and
  // leave the current state untouched in the 1180–1300 dead-band. The gap stops
  // a scrollbar toggling near a single threshold from oscillating the sidebar
  // (the "bounce"). Manual ⌘B / trigger still works between the bounds.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1280px)").matches,
  );
  useEffect(() => {
    const collapseMq = window.matchMedia("(max-width: 1179px)");
    const expandMq = window.matchMedia("(min-width: 1300px)");
    const apply = () => {
      if (collapseMq.matches) setSidebarOpen(false);
      else if (expandMq.matches) setSidebarOpen(true);
    };
    apply();
    collapseMq.addEventListener("change", apply);
    expandMq.addEventListener("change", apply);
    return () => {
      collapseMq.removeEventListener("change", apply);
      expandMq.removeEventListener("change", apply);
    };
  }, []);

  // Mobile broker shell: full-bleed content + floating bottom nav (Propo lives
  // in the center FAB, so no separate AgentFAB here).
  if (shellMode === "bottom-nav") {
    return (
      // Both strips are measured, not assumed: MobileTopBar publishes
      // --app-header-h and MobileBottomNav publishes --app-nav-h, so the
      // viewport-pinned primitives below subtract the real numbers. This shell
      // used to pin --app-header-h to 0 because it genuinely had no header.
      <AgentOverlayProvider>
        <TopbarSlotProvider>
          <ImmersiveProvider>
            <div className="flex min-h-dvh flex-col bg-background">
              <SkipToContent />
              {/* The shell's own sticky chrome. It publishes its measured height to
              --app-header-h, so the token is honest in this shell instead of
              being pinned to 0 as it was when the shell had no header. */}
              <MobileTopBar />
              {/* tabIndex -1 so PageMetaProvider can move focus here on navigation
            without putting the region itself in the tab sequence.

            The top inset now belongs to MobileTopBar, which sits above this
            element and carries --safe-top itself — putting it here as well
            would double the clearance under a Dynamic Island. Left/right still
            matter in landscape, where the cutout moves to the side, and the
            bottom clears the floating nav. All resolve to 0 on a laptop or
            tablet, so those layouts are unchanged. */}
              <main
                id="main-content"
                tabIndex={-1}
                className="flex-1 outline-none pr-[var(--safe-right)] pb-[var(--app-nav-h,0px)] pl-[var(--safe-left)]"
              >
                <RouteSuspense />
              </main>
              <TenantSwitchGate />
              <MobileBottomNav />
              <InstallNudge />
            </div>
          </ImmersiveProvider>
        </TopbarSlotProvider>
      </AgentOverlayProvider>
    );
  }

  return (
    // pl/pr carry the landscape insets: on a phone held sideways the notch sits
    // beside the nav rail, and the sidebar rendered straight under it. Both are
    // 0 on a laptop or tablet, so those layouts are untouched.
    <AgentOverlayProvider>
      {/* --sidebar-width is derived from the longest label the current role can
          actually see, not from a constant. `style` is spread after the
          defaults inside SidebarProvider, so this wins; until the probe reports,
          the component default applies. */}
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        style={
          navWidth ? ({ "--sidebar-width": `${navWidth}px` } as React.CSSProperties) : undefined
        }
      >
        <SkipToContent />
        <SidebarWidthProbe labels={navLabels} onMeasure={setNavWidthIfChanged} />
        <AppSidebar />
        {/* Bound the shell to the viewport so the inner <main> is the scroll
          container — keeps the header pinned (a window-level scroll trapped the
          header's sticky inside the wrapper's overflow-hidden). */}
        <SidebarInset className="h-svh overflow-hidden pr-[var(--safe-right)]">
          <header className="sticky top-0 z-10 flex h-[var(--app-header-h)] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <HeaderWorkspaceSwitcher />
            <div className="flex flex-1 items-center justify-center px-2">
              <CommandBar />
            </div>
            <div className="flex items-center [&>button]:h-9 [@media(pointer:coarse)]:[&>button]:h-11">
              <UfButton />
            </div>
            <HeaderThemeToggle />
            <div className="block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:size-11">
                    <Avatar size="sm">
                      {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
                      <AvatarFallback>{user ? initials(user.fullName) : "?"}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {user && (
                    <>
                      <DropdownMenuLabel className="font-normal">
                        <p className="text-sm font-medium">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {user.role.toLowerCase()}
                        </p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="size-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                  {/* Same signature the phone shows under "Más". Two shells,
                      one answer to "which build is this". */}
                  <DropdownMenuSeparator />
                  <div className="px-1 py-0.5">
                    <BuildStampRow />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto outline-none"
          >
            <RouteSuspense />
          </main>
          {/* FAB only where the header command bar is hidden (below md). */}
          <div className="md:hidden">
            {(() => {
              // Propo is ADMIN-only (backend require_role ADMIN). Gate on view,
              // not scope-emptiness, so it never renders for non-admin roles.
              const view = user?.view;
              const isAdmin = view === "admin" || view === "admin-dev";
              const scope = user?.adminScope ?? [];
              if (!isAdmin || (scope.length > 0 && !scope.includes("agent"))) return null;
              return <AgentFAB />;
            })()}
          </div>
          <TenantSwitchGate />
          <InstallNudge />
        </SidebarInset>
      </SidebarProvider>
    </AgentOverlayProvider>
  );
}
