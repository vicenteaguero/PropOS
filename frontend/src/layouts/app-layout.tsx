import { Outlet, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
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
import { AgentFAB } from "@features/agent/components/agent-fab";
import { InstallNudge } from "@shared/components/install-nudge/install-nudge";
import { useUfDailyRefresh } from "@features/uf/hooks/use-uf";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AppLayout() {
  const { user, signOut } = useAuth();
  const shellMode = useShellMode();
  const location = useLocation();
  // Inside Anita's own page the header's Anita launcher is redundant.
  const isAgentRoute = location.pathname.endsWith("/agent");
  useUfDailyRefresh();

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
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-[var(--app-header-h)] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-center px-2">
            {!isAgentRoute && <CommandBar />}
          </div>
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
        <main className="flex-1 overflow-x-hidden">
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
