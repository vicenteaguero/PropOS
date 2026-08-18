import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Check, LogOut, Moon, Sun } from "lucide-react";
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
import { CommandBar } from "@shared/components/command-bar/command-bar";
import { useAuth } from "@shared/hooks/use-auth";
import { useShellMode } from "@shared/hooks/use-shell-mode";
import { useThemeMode } from "@core/theme/theme-provider";
import { hueForTenant } from "@core/theme/tenant-accent";
import { AgentFAB } from "@features/agent/components/agent-fab";
import { InstallNudge } from "@shared/components/install-nudge/install-nudge";
import { useUfDailyRefresh } from "@features/uf/hooks/use-uf";
import { UfButton } from "@features/uf/components/uf-button";
import { WorkspacePill } from "@shared/ui";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Top-bar workspace selector (always visible). Dropdown when >1 membership. */
function HeaderWorkspaceSwitcher() {
  const { memberships, user, switchTenant } = useAuth();
  if (!user) return null;
  const current = memberships.find((m) => m.tenantId === user.tenantId);
  const label = current?.tenantName ?? current?.tenantSlug ?? "Workspace";

  if (memberships.length <= 1) {
    return <WorkspacePill label={label} className="cursor-default active:scale-100" />;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <WorkspacePill label={label} />
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
                style={{
                  background: active
                    ? "var(--accent-brand)"
                    : `hsl(${hueForTenant(m.tenantId)} 55% 55%)`,
                }}
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
      className="flex size-11 items-center justify-center rounded-full text-foreground transition hover:bg-secondary active:scale-90"
    >
      {isDark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
    </button>
  );
}

export function AppLayout() {
  const { user, signOut } = useAuth();
  const shellMode = useShellMode();
  const location = useLocation();
  // Inside Propo's own page the header's Propo launcher is redundant.
  const isAgentRoute = location.pathname.endsWith("/agent");
  useUfDailyRefresh();

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
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="flex-1 pb-28">
          <Outlet />
        </main>
        <MobileBottomNav />
        <InstallNudge />
      </div>
    );
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      {/* Bound the shell to the viewport so the inner <main> is the scroll
          container — keeps the header pinned (a window-level scroll trapped the
          header's sticky inside the wrapper's overflow-hidden). */}
      <SidebarInset className="h-svh overflow-hidden">
        <header className="sticky top-0 z-10 flex h-[var(--app-header-h)] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <HeaderWorkspaceSwitcher />
          <div className="flex flex-1 items-center justify-center px-2">
            {!isAgentRoute && <CommandBar />}
          </div>
          <UfButton />
          <HeaderThemeToggle />
          <div className="block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar size="sm">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
                    <AvatarFallback>{user ? getInitials(user.fullName) : "?"}</AvatarFallback>
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
        {/* FAB on tablet/mobile-sidebar shell; desktop uses the header ⌘K bar. */}
        <div className="lg:hidden">
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
        <InstallNudge />
      </SidebarInset>
    </SidebarProvider>
  );
}
