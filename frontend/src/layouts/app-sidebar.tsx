import { NavLink, useLocation } from "react-router-dom";
import { prefetchRoute } from "@shared/lib/route-chunks";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@shared/hooks/use-auth";
import { SETTINGS_PATH, type NavItem } from "@layouts/nav-items";
import { WipDot } from "@shared/feature/wip-notice";
import { entryFor } from "@shared/feature/catalog";
import { useNavGroups, usePendingCount } from "@layouts/use-nav-groups";
import { useUnreadCount } from "@features/attention/hooks/use-unread";

// Collapsed geometry is expressed only in animatable properties, on the same
// 300ms ease-in-out curve as the rail width (see SIDEBAR_TRANSITION in
// components/ui/sidebar.tsx). No `!important` — it would win over the very
// padding `transition-[width,height,padding]` is there to animate — and no
// `hidden`, which snaps at t=0 and used to make the rows jump on collapse.
// The button stays `w-full`, so its width tracks the rail continuously instead
// of running a second, competing transition.
const ITEM_CLASS = cn(
  "h-8 px-2 text-[13px] [&>svg]:size-[18px] [&>span]:max-w-[12.5rem]",
  "[&>svg]:transition-[width,height] [&>svg]:duration-300 [&>svg]:ease-in-out",
  "group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center",
  // 22px on a 56px rail (see SIDEBAR_WIDTH_ICON): the icon is the only thing
  // left once the label is gone, so it carries the row on its own.
  "group-data-[collapsible=icon]:[&>svg]:size-[22px]",
  // max-width, not width/display: the label is a flex item whose computed width
  // is `auto`, and `auto` cannot be interpolated. 12.5rem is just above the
  // label's natural width at 16rem, so the shrink starts immediately.
  "group-data-[collapsible=icon]:[&>span]:max-w-0",
);

function NavItemRow({
  item,
  pendingCount,
  unreadCount,
  wip,
  onNavigate,
}: {
  item: NavItem;
  pendingCount: number;
  unreadCount: number;
  wip: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const count = item.badge === "pending" ? pendingCount : item.badge === "unread" ? unreadCount : 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.label} className={ITEM_CLASS}>
        <NavLink
          to={item.path}
          end={item.end}
          // Hover is the desktop signal that this page is about to be needed;
          // its chunk downloads while the cursor is still travelling.
          onMouseEnter={() => prefetchRoute(item.path)}
          onFocus={() => prefetchRoute(item.path)}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? "bg-sidebar-accent text-sidebar-primary" : "")}
        >
          <Icon />
          <span className="flex-1 truncate">{item.label}</span>
          {wip && <WipDot />}
          {item.devOnly && (
            <span className="rounded bg-warning/20 px-1 py-0 text-[11px] font-bold uppercase tracking-wide text-warning">
              dev
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
      {count > 0 && <SidebarMenuBadge className="top-1">{count}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { signOut, user, features } = useAuth();
  const { pathname } = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const { groups: allGroups } = useNavGroups();
  // Configuración is rendered in the footer, next to sign-out, so it must not
  // also appear in the scrolling destination list above.
  const groups = allGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.path !== SETTINGS_PATH) }))
    .filter((g) => g.items.length > 0);
  const pendingCount = usePendingCount();
  const unreadCount = useUnreadCount();

  if (!user) return null;

  const isDevAdmin = !!user.isDevAdmin;
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      {/* Grid, not flex: `grid-template-columns` interpolates, so the title
          column can shrink to nothing on the shared curve. A flex child cannot
          animate away — its width is `auto` and `display:none` snaps. */}
      <SidebarHeader
        className={cn(
          "grid grid-cols-[auto_1fr] items-center gap-2.5 px-2.5 py-2.5",
          "transition-[grid-template-columns,gap,padding] duration-300 ease-in-out",
          "group-data-[collapsible=icon]:grid-cols-[auto_0fr] group-data-[collapsible=icon]:gap-0",
          "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
        )}
      >
        <img
          src="/icon.svg"
          alt="PropOS"
          className="size-8 shrink-0 rounded-lg ring-2 ring-primary/20 shadow-md shadow-primary/10"
        />
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-left transition-opacity duration-300 ease-in-out group-data-[collapsible=icon]:opacity-0">
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
            className="px-2 py-1 transition-[padding] duration-300 ease-in-out group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-0.5"
          >
            {group.label && (
              // No `hidden`: SidebarGroupLabel collapses its own height on the
              // shared curve, which is what stops the rows below from snapping.
              <SidebarGroupLabel className="h-6 px-2 text-[11px] uppercase tracking-wider">
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
                    unreadCount={unreadCount}
                    // The dev admin who set the state does not need the marker.
                    wip={!user.isDevAdmin && entryFor(features, item.feature).state === "wip"}
                    onNavigate={onNavigate}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Settings and sign-out are not destinations you browse to — they are
          where you go when you are done. Both live at the bottom of the rail,
          in that order, which is where every desktop app puts them. */}
      <SidebarFooter className="gap-0.5 border-t border-sidebar-border px-2 py-2">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(SETTINGS_PATH)}
              tooltip="Configuración"
              className={ITEM_CLASS}
            >
              <NavLink to={SETTINGS_PATH} onClick={onNavigate}>
                <Settings />
                <span className="flex-1 truncate">Configuración</span>
              </NavLink>
            </SidebarMenuButton>
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
              <span className="flex-1 truncate">Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
