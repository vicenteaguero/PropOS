import { NavLink } from "react-router-dom";
import {
  Building2,
  Users,
  FolderKanban,
  Shield,
  MessageSquare,
  FileText,
  PenTool,
  FlaskConical,
  LogOut,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@shared/hooks/use-auth";
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
    { label: "Test Lab", path: "/admin/test-lab", icon: FlaskConical },
  ],
  AGENT: [
    { label: "Propiedades", path: "/agent/properties", icon: Building2 },
    { label: "Contactos", path: "/agent/contacts", icon: Users },
    { label: "Interacciones", path: "/agent/interactions", icon: MessageSquare },
    { label: "Test Lab", path: "/agent/test-lab", icon: FlaskConical },
  ],
  LANDOWNER: [
    { label: "Mis Propiedades", path: "/landowner/properties", icon: Building2 },
    { label: "Documentos", path: "/landowner/documents", icon: FileText },
    { label: "Test Lab", path: "/landowner/test-lab", icon: FlaskConical },
  ],
  BUYER: [
    { label: "Propiedades", path: "/buyer/properties", icon: Building2 },
    { label: "Proyectos", path: "/buyer/projects", icon: FolderKanban },
    { label: "Test Lab", path: "/buyer/test-lab", icon: FlaskConical },
  ],
  CONTENT: [
    { label: "Proyectos", path: "/content/projects", icon: FolderKanban },
    { label: "Contenido", path: "/content/assets", icon: PenTool },
    { label: "Test Lab", path: "/content/test-lab", icon: FlaskConical },
  ],
};

export function getNavItemsForRole(role: UserRole): SidebarNavItem[] {
  return NAV_ITEMS_BY_ROLE[role] ?? [];
}

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();

  if (!user) return null;

  const items = getNavItemsForRole(user.role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="cursor-default">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">PropOS</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.fullName}
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
                      onClick={() => isMobile && setOpenMobile(false)}
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { if (isMobile) setOpenMobile(false); signOut(); }} tooltip="Cerrar Sesión">
              <LogOut />
              <span>Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
