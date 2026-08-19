import { NavLink } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
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
import type { UserView } from "@shared/types/auth";
import { type NavItem } from "@layouts/nav-items";
import { useNavGroups, usePendingCount } from "@layouts/use-nav-groups";

const ITEM_CLASS =
  "h-8 !px-2 text-[13px] [&>svg]:size-[18px] group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:[&>svg]:size-5 group-data-[collapsible=icon]:[&>span]:hidden";

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
          <span className="flex-1 truncate">{item.label}</span>
          {item.devOnly && (
            <span className="rounded bg-warning/20 px-1 py-0 text-[11px] font-bold uppercase tracking-wide text-warning">
              dev
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
      {showBadge && <SidebarMenuBadge className="top-1">{pendingCount}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();
  const { groups } = useNavGroups();
  const pendingCount = usePendingCount();

  if (!user) return null;

  const view: UserView = (user.view as UserView | undefined) ?? "agent";
  const isDevAdmin = !!user.isDevAdmin;
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isAdminView = view === "admin" || view === "admin-dev";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-2.5 px-2.5 py-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <img
          src="/icon.svg"
          alt="PropOS"
          className="size-8 shrink-0 rounded-lg ring-2 ring-primary/20 shadow-md shadow-primary/10"
        />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left group-data-[collapsible=icon]:hidden">
          <span className="truncate text-[15px] font-bold tracking-tight">PropOS</span>
          {isDevAdmin && (
            <span className="rounded bg-warning/20 px-1.5 py-0 text-[11px] font-bold uppercase tracking-wide text-warning">
              DEV
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {groups.map((group, idx) => (
          <SidebarGroup
            key={group.label ?? `group-${idx}`}
            className="px-2 py-1 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-0.5"
          >
            {group.label && (
              <SidebarGroupLabel className="h-6 px-2 text-[11px] uppercase tracking-wider group-data-[collapsible=icon]:hidden group-data-[state=collapsed]:hidden">
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
          {isAdminView && (
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
                  <span className="flex-1 truncate">Configuración</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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
              <span className="flex-1 truncate">Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
