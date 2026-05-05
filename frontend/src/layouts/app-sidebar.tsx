import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CheckSquare,
  FileText,
  Folder,
  Home,
  Inbox,
  ListChecks,
  LogOut,
  MessageCircle,
  MessageSquare,
  Phone,
  Receipt,
  Sparkles,
  Users,
} from "lucide-react";
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
import type { UserRole } from "@shared/types/auth";

export interface SidebarNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS_BY_ROLE: Record<UserRole, SidebarNavItem[]> = {
  ADMIN: [
    { label: "Inicio", path: "/admin", icon: Home, end: true },
    { label: "Anita", path: "/admin/anita", icon: Sparkles },
    { label: "Pendientes de Anita", path: "/admin/pendientes", icon: Inbox },
    { label: "Inbox clientes (WA)", path: "/admin/client-inbox", icon: MessageCircle },
    { label: "Teléfonos (WA)", path: "/admin/phones", icon: Phone },
    { label: "Documentos", path: "/admin/documents", icon: FileText },
    { label: "Enlaces de subida", path: "/admin/documents/portals", icon: Folder },
    { label: "Workflows", path: "/admin/workflows", icon: ListChecks },
    { label: "Analítica", path: "/admin/analytics", icon: BarChart3 },
    { label: "Costo Anita", path: "/admin/analytics/anita-cost", icon: Receipt },
  ],
  AGENT: [
    { label: "Inicio", path: "/agent", icon: Home, end: true },
    { label: "Pendientes", path: "/agent/pendientes", icon: Inbox },
    { label: "Inbox clientes", path: "/agent/client-inbox", icon: MessageCircle },
    { label: "Personas", path: "/agent/personas", icon: Users },
    { label: "Interacciones", path: "/agent/interacciones", icon: MessageSquare },
    { label: "Tareas", path: "/agent/tareas", icon: CheckSquare },
    { label: "Documentos", path: "/agent/documents", icon: FileText },
    { label: "Enlaces de subida", path: "/agent/documents/portals", icon: Folder },
  ],
  LANDOWNER: [
    { label: "Inicio", path: "/landowner", icon: Home, end: true },
    { label: "Documentos", path: "/landowner/documents", icon: FileText },
  ],
  BUYER: [
    { label: "Inicio", path: "/buyer", icon: Home, end: true },
    { label: "Documentos", path: "/buyer/documents", icon: FileText },
  ],
  CONTENT: [
    { label: "Inicio", path: "/content", icon: Home, end: true },
    { label: "Anita", path: "/content/pendientes", icon: Sparkles },
  ],
};

export function getNavItemsForRole(role: UserRole): SidebarNavItem[] {
  return NAV_ITEMS_BY_ROLE[role] ?? [];
}

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { state, setOpenMobile, isMobile } = useSidebar();

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
          <span className="truncate text-xs text-muted-foreground">{user.fullName}</span>
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
                      end={item.end}
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
            <SidebarMenuButton
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                signOut();
              }}
              tooltip="Cerrar sesión"
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
