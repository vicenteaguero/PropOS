import { NavLink } from "react-router-dom";
import {
  Building2,
  Users,
  FolderKanban,
  Shield,
  MessageSquare,
  MessageCircle,
  FileText,
  PenTool,
  FlaskConical,
  LogOut,
  Settings,
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@shared/hooks/use-auth";
import { useUnreadCount, markChatAsRead } from "@shared/hooks/use-unread-count";
import { useHealthCheck } from "@shared/hooks/use-health-check";
import type { UserRole } from "@shared/types/auth";

export interface SidebarNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const NAV_ITEMS_BY_ROLE: Record<UserRole, SidebarNavItem[]> = {
  ADMIN: [
    { label: "Propiedades", path: "/admin/properties", icon: Building2 },
    { label: "Contactos", path: "/admin/contacts", icon: Users },
    { label: "Proyectos", path: "/admin/projects", icon: FolderKanban },
    { label: "Equipo", path: "/admin/users", icon: Shield },
    { label: "Chat", path: "/admin/chat", icon: MessageCircle },
    { label: "Test Lab", path: "/admin/test-lab", icon: FlaskConical },
    { label: "Configuración", path: "/admin/settings", icon: Settings },
  ],
  AGENT: [
    { label: "Propiedades", path: "/agent/properties", icon: Building2 },
    { label: "Contactos", path: "/agent/contacts", icon: Users },
    { label: "Interacciones", path: "/agent/interactions", icon: MessageSquare },
    { label: "Chat", path: "/agent/chat", icon: MessageCircle },
    { label: "Test Lab", path: "/agent/test-lab", icon: FlaskConical },
    { label: "Configuración", path: "/agent/settings", icon: Settings },
  ],
  LANDOWNER: [
    { label: "Mis Propiedades", path: "/landowner/properties", icon: Building2 },
    { label: "Documentos", path: "/landowner/documents", icon: FileText },
    { label: "Chat", path: "/landowner/chat", icon: MessageCircle },
    { label: "Test Lab", path: "/landowner/test-lab", icon: FlaskConical },
    { label: "Configuración", path: "/landowner/settings", icon: Settings },
  ],
  BUYER: [
    { label: "Propiedades", path: "/buyer/properties", icon: Building2 },
    { label: "Proyectos", path: "/buyer/projects", icon: FolderKanban },
    { label: "Chat", path: "/buyer/chat", icon: MessageCircle },
    { label: "Test Lab", path: "/buyer/test-lab", icon: FlaskConical },
    { label: "Configuración", path: "/buyer/settings", icon: Settings },
  ],
  CONTENT: [
    { label: "Proyectos", path: "/content/projects", icon: FolderKanban },
    { label: "Contenido", path: "/content/assets", icon: PenTool },
    { label: "Chat", path: "/content/chat", icon: MessageCircle },
    { label: "Test Lab", path: "/content/test-lab", icon: FlaskConical },
    { label: "Configuración", path: "/content/settings", icon: Settings },
  ],
};

export function getNavItemsForRole(role: UserRole): SidebarNavItem[] {
  return NAV_ITEMS_BY_ROLE[role] ?? [];
}

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const unreadCount = useUnreadCount();
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
              {items.map((item) => {
                const isChat = item.label === "Chat";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <NavLink
                        to={item.path}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                          if (isChat) markChatAsRead();
                        }}
                        className={({ isActive }) =>
                          isActive ? "text-sidebar-primary bg-sidebar-accent" : ""
                        }
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {isChat && unreadCount > 0 && (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
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
