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
  Newspaper,
  Phone,
  Receipt,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@shared/hooks/use-auth";
import { useEffectiveUser } from "@core/view-as/view-as";
import { useAgentName } from "@core/branding/agent-branding";
import { PaletteSwitcher } from "@shared/components/palette-switcher/palette-switcher";
import { apiRequest } from "@features/documents/api/http";
import type { UserRole } from "@shared/types/auth";

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: "pending";
  scope?: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

function filterByScope(groups: NavGroup[], adminScope: string[]): NavGroup[] {
  if (adminScope.length === 0) return groups;
  const allowed = new Set(adminScope);
  const visible = (item: NavItem) => !item.scope || allowed.has(item.scope);
  return groups
    .map((g) => ({ ...g, items: g.items.filter(visible) }))
    .filter((g) => g.items.length > 0);
}

function buildGroups(role: UserRole, agentName: string): NavGroup[] {
  switch (role) {
    case "ADMIN":
      return [
        { items: [{ label: "Inicio", path: "/admin", icon: Home, end: true }] },
        {
          label: agentName,
          items: [
            { label: agentName, path: "/admin/agent", icon: Sparkles, scope: "agent" },
            {
              label: "Pendientes",
              path: "/admin/pendientes",
              icon: Inbox,
              badge: "pending",
              scope: "pendientes",
            },
            {
              label: "Costo",
              path: "/admin/analytics/agent-cost",
              icon: Receipt,
              scope: "analytics",
            },
          ],
        },
        {
          label: "Comunicación",
          items: [
            {
              label: "Inbox WA",
              path: "/admin/client-inbox",
              icon: MessageCircle,
              scope: "inbox",
            },
            { label: "Teléfonos", path: "/admin/phones", icon: Phone, scope: "phones" },
          ],
        },
        {
          label: "Datos",
          items: [
            { label: "Documentos", path: "/admin/documents", icon: FileText, scope: "documents" },
            {
              label: "Enlaces",
              path: "/admin/documents/portals",
              icon: Folder,
              scope: "documents",
            },
          ],
        },
        {
          label: "Operación",
          items: [
            { label: "Workflows", path: "/admin/workflows", icon: ListChecks, scope: "workflows" },
            { label: "Analítica", path: "/admin/analytics", icon: BarChart3, scope: "analytics" },
          ],
        },
      ];
    case "AGENT":
      return [
        { items: [{ label: "Inicio", path: "/agent", icon: Home, end: true }] },
        {
          label: "Trabajo",
          items: [
            { label: "Pendientes", path: "/agent/pendientes", icon: Inbox, badge: "pending" },
            { label: "Tareas", path: "/agent/tareas", icon: CheckSquare },
            { label: "Workflows", path: "/agent/workflows", icon: ListChecks },
          ],
        },
        {
          label: "CRM",
          items: [
            { label: "Personas", path: "/agent/personas", icon: Users },
            { label: "Interacciones", path: "/agent/interacciones", icon: MessageSquare },
            { label: "Inbox WA", path: "/agent/client-inbox", icon: MessageCircle },
          ],
        },
        {
          label: "Datos",
          items: [
            { label: "Documentos", path: "/agent/documents", icon: FileText },
            { label: "Enlaces", path: "/agent/documents/portals", icon: Folder },
          ],
        },
      ];
    case "LANDOWNER":
      return [
        {
          items: [
            { label: "Inicio", path: "/landowner", icon: Home, end: true },
            { label: "Documentos", path: "/landowner/documents", icon: FileText },
          ],
        },
      ];
    case "BUYER":
      return [
        {
          items: [
            { label: "Inicio", path: "/buyer", icon: Home, end: true },
            { label: "Documentos", path: "/buyer/documents", icon: FileText },
          ],
        },
      ];
    case "CONTENT":
      return [
        {
          items: [
            { label: "Inicio", path: "/content", icon: Home, end: true },
            { label: agentName, path: "/content/pendientes", icon: Sparkles },
          ],
        },
      ];
    default:
      return [];
  }
}

function usePendingCount(): number {
  const query = useQuery<{ pending_count: number }>({
    queryKey: ["analytics", "pending-count"],
    queryFn: () => apiRequest("/v1/analytics/pending-count"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return query.data?.pending_count ?? 0;
}

const ITEM_CLASS =
  "h-8 !px-2 text-[13px] [&>svg]:size-[18px] group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:[&>svg]:size-5";

function NavItemRow({
  item,
  pendingCount,
  onNavigate,
}: {
  item: NavItem;
  pendingCount: number;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const showBadge = item.badge === "pending" && pendingCount > 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.label} className={ITEM_CLASS}>
        <NavLink
          to={item.path}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "bg-sidebar-accent text-sidebar-primary" : "")}
        >
          <Icon />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
      {showBadge && <SidebarMenuBadge className="top-1">{pendingCount}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { signOut } = useAuth();
  const user = useEffectiveUser();
  const { setOpenMobile, isMobile } = useSidebar();
  const agentName = useAgentName();
  const pendingCount = usePendingCount();

  if (!user) return null;

  const groups = filterByScope(buildGroups(user.role, agentName), user.adminScope ?? []);
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isAdmin = user.role === "ADMIN";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-2.5 px-2.5 py-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <img
          src="/icon.svg"
          alt="PropOS"
          className="size-8 shrink-0 rounded-lg ring-2 ring-primary/20 shadow-md shadow-primary/10"
        />
        <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate text-[13px] font-semibold">PropOS</span>
          <span className="truncate text-[11px] text-muted-foreground">{user.fullName}</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {groups.map((group, idx) => (
          <SidebarGroup
            key={group.label ?? `group-${idx}`}
            className="px-2 py-1 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-0.5"
          >
            {group.label && (
              <SidebarGroupLabel className="h-6 px-2 text-[10px] uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <NavItemRow
                    key={item.path}
                    item={item}
                    pendingCount={pendingCount}
                    onNavigate={onNavigate}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-0.5 border-t border-sidebar-border px-2 py-2">
        <SidebarMenu className="gap-0.5">
          {isAdmin && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Novedades" className={ITEM_CLASS}>
                  <NavLink
                    to="/admin/novedades"
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      isActive ? "bg-sidebar-accent text-sidebar-primary" : ""
                    }
                  >
                    <Newspaper />
                    <span>Novedades</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Configuración" className={ITEM_CLASS}>
                  <NavLink
                    to="/admin/settings"
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      isActive ? "bg-sidebar-accent text-sidebar-primary" : ""
                    }
                  >
                    <Settings />
                    <span>Configuración</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
          <SidebarMenuItem>
            <PaletteSwitcher className={ITEM_CLASS} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onNavigate();
                signOut();
              }}
              tooltip="Cerrar sesión"
              className={ITEM_CLASS}
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
