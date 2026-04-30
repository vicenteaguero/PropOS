import { NavLink } from "react-router-dom";
import { FileText, Folder, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@shared/hooks/use-auth";
import { useHealthCheck } from "@shared/hooks/use-health-check";
import type { UserRole } from "@shared/types/auth";

export interface SidebarNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const NAV_ITEMS_BY_ROLE: Record<UserRole, SidebarNavItem[]> = {
  ADMIN: [
    { label: "Documentos", path: "/admin/documents", icon: FileText },
    { label: "Portales", path: "/admin/documents/portals", icon: Folder },
  ],
  AGENT: [
    { label: "Documentos", path: "/agent/documents", icon: FileText },
    { label: "Portales", path: "/agent/documents/portals", icon: Folder },
  ],
  LANDOWNER: [
    { label: "Documentos", path: "/landowner/documents", icon: FileText },
  ],
  BUYER: [
    { label: "Documentos", path: "/buyer/documents", icon: FileText },
  ],
  CONTENT: [],
};

export function getNavItemsForRole(role: UserRole): SidebarNavItem[] {
  return NAV_ITEMS_BY_ROLE[role] ?? [];
}

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { data: health } = useHealthCheck();
  const healthStatus = health?.status ?? "down";
  const healthColor = healthStatus === "healthy" ? "bg-emerald-500" : healthStatus === "degraded" ? "bg-yellow-500" : "bg-red-500";
  const healthLabel = healthStatus === "healthy" ? "API conectada" : healthStatus === "degraded" ? "API lenta" : "API sin conexión";

  if (!user) return null;

  const items = getNavItemsForRole(user.role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-3 px-4 py-4">
        <img
          src={state === "expanded" ? "/logo.png" : "/icon.svg"}
          alt="PropOS"
          className="size-8 md:size-10 shrink-0 rounded-lg ring-2 ring-primary/20 shadow-lg shadow-primary/10"
        />
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">PropOS</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.fullName}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={item.path}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                      }}
                      className={({ isActive }) =>
                        isActive ? "text-sidebar-primary bg-sidebar-accent" : ""
                      }
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={healthLabel} className="pointer-events-none">
              <span className={`size-2 shrink-0 rounded-full ${healthColor}`} />
              <span className="text-xs text-muted-foreground">{healthLabel}{health?.latency != null ? ` (${health.latency}ms)` : ""}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { if (isMobile) setOpenMobile(false); signOut(); }} tooltip="Cerrar sesión">
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
