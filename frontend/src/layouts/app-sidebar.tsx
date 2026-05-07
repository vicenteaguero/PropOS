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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@shared/hooks/use-auth";
import { useEffectiveUser } from "@core/view-as/view-as";
import { useAgentName } from "@core/branding/agent-branding";
import { PaletteSwitcher } from "@shared/components/palette-switcher/palette-switcher";
import { WhatsAppIcon } from "@shared/components/icons/whatsapp-icon";
import { apiRequest } from "@features/documents/api/http";
import type { UserRole } from "@shared/types/auth";
import type { ComponentType, SVGProps } from "react";

type IconLike = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  label: string;
  path: string;
  icon: IconLike;
  end?: boolean;
  trailingIcon?: IconLike;
  badge?: "pending";
  children?: NavItem[];
  scope?: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

function filterByScope(groups: NavGroup[], adminScope: string[]): NavGroup[] {
  if (adminScope.length === 0) return groups;
  const allowed = new Set(adminScope);
  const visible = (item: NavItem) => !item.scope || allowed.has(item.scope);
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(visible).map((item) => ({
        ...item,
        children: item.children?.filter(visible),
      })),
    }))
    .filter((g) => g.items.length > 0);
}

function buildGroups(role: UserRole, agentName: string): NavGroup[] {
  switch (role) {
    case "ADMIN":
      return [
        {
          items: [
            { label: "Inicio", path: "/admin", icon: Home, end: true },
            { label: "Novedades", path: "/admin/novedades", icon: Newspaper },
          ],
        },
        {
          label: "IA",
          items: [
            {
              label: agentName,
              path: "/admin/agent",
              icon: Sparkles,
              scope: "agent",
              children: [
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
          ],
        },
        {
          label: "Comunicación",
          items: [
            {
              label: "Inbox clientes",
              path: "/admin/client-inbox",
              icon: MessageCircle,
              trailingIcon: WhatsAppIcon,
              scope: "inbox",
            },
            {
              label: "Teléfonos",
              path: "/admin/phones",
              icon: Phone,
              trailingIcon: WhatsAppIcon,
              scope: "phones",
            },
          ],
        },
        {
          label: "Datos",
          items: [
            { label: "Documentos", path: "/admin/documents", icon: FileText, scope: "documents" },
            {
              label: "Enlaces de subida",
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
        {
          label: "Sistema",
          items: [
            { label: "Novedades", path: "/admin/novedades", icon: Newspaper },
            { label: "Configuración", path: "/admin/settings", icon: Settings },
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
            {
              label: "Inbox clientes",
              path: "/agent/client-inbox",
              icon: MessageCircle,
              trailingIcon: WhatsAppIcon,
            },
          ],
        },
        {
          label: "Datos",
          items: [
            { label: "Documentos", path: "/agent/documents", icon: FileText },
            { label: "Enlaces de subida", path: "/agent/documents/portals", icon: Folder },
          ],
        },
      ];
    case "LANDOWNER":
      return [
        { items: [{ label: "Inicio", path: "/landowner", icon: Home, end: true }] },
        {
          label: "Datos",
          items: [{ label: "Documentos", path: "/landowner/documents", icon: FileText }],
        },
      ];
    case "BUYER":
      return [
        { items: [{ label: "Inicio", path: "/buyer", icon: Home, end: true }] },
        {
          label: "Datos",
          items: [{ label: "Documentos", path: "/buyer/documents", icon: FileText }],
        },
      ];
    case "CONTENT":
      return [
        { items: [{ label: "Inicio", path: "/content", icon: Home, end: true }] },
        { label: "IA", items: [{ label: agentName, path: "/content/pendientes", icon: Sparkles }] },
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

function NavItemRow({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pendingCount = usePendingCount();
  const Icon = item.icon;
  const Trailing = item.trailingIcon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.label}>
        <NavLink
          to={item.path}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "text-sidebar-primary bg-sidebar-accent" : "")}
        >
          <Icon />
          <span>{item.label}</span>
          {Trailing && <Trailing className="ml-auto size-3.5 opacity-60" />}
        </NavLink>
      </SidebarMenuButton>
      {item.badge === "pending" && pendingCount > 0 && (
        <SidebarMenuBadge>{pendingCount}</SidebarMenuBadge>
      )}
      {item.children && item.children.length > 0 && (
        <SidebarMenuSub>
          {item.children.map((child) => (
            <SubItemRow key={child.path} item={child} onNavigate={onNavigate} />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

function SubItemRow({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pendingCount = usePendingCount();
  const Icon = item.icon;
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild>
        <NavLink
          to={item.path}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "text-sidebar-primary bg-sidebar-accent" : "")}
        >
          <Icon />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuSubButton>
      {item.badge === "pending" && pendingCount > 0 && (
        <SidebarMenuBadge>{pendingCount}</SidebarMenuBadge>
      )}
    </SidebarMenuSubItem>
  );
}

export function AppSidebar() {
  const { signOut } = useAuth();
  const user = useEffectiveUser();
  const { setOpenMobile, isMobile } = useSidebar();
  const agentName = useAgentName();

  if (!user) return null;

  const groups = filterByScope(buildGroups(user.role, agentName), user.adminScope ?? []);
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-3 px-4 py-4">
        <img
          src="/icon.svg"
          alt="PropOS"
          className="size-8 md:size-10 shrink-0 rounded-lg ring-2 ring-primary/20 shadow-lg shadow-primary/10"
        />
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">PropOS</span>
          <span className="truncate text-xs text-muted-foreground">{user.fullName}</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, idx) => (
          <SidebarGroup key={group.label ?? `group-${idx}`}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItemRow key={item.path} item={item} onNavigate={onNavigate} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <PaletteSwitcher />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onNavigate();
                signOut();
              }}
              tooltip="Cerrar sesión"
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 pt-2 text-[10px] text-muted-foreground/70">v{APP_VERSION}</p>
      </SidebarFooter>
    </Sidebar>
  );
}
