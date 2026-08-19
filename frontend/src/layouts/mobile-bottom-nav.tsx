import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Check,
  Home,
  LayoutGrid,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { useThemeMode } from "@core/theme/theme-provider";
import { hueForTenant } from "@core/theme/tenant-accent";
import { AgentOverlay } from "@features/agent/components/agent-overlay";
import { BottomSheet, Pill } from "@shared/ui";
import { useNavGroups, usePendingCount } from "@layouts/use-nav-groups";
import { cn } from "@/lib/utils";
import type { UserView } from "@shared/types/auth";
import { initials } from "@shared/utils/format";

function NavTab({
  to,
  end,
  icon: Icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <NavLink to={to} end={end} className="flex flex-1 flex-col items-center gap-0.5 py-1">
      {({ isActive }) => (
        <>
          <Icon
            className={cn("size-[22px]", isActive ? "text-foreground" : "text-muted-foreground")}
            strokeWidth={isActive ? 2.2 : 1.8}
          />
          <span
            className={cn(
              "text-[11px]",
              isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground",
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

/**
 * Publishes the nav's rendered height to `--app-nav-h` on <html> and clears it
 * on unmount. Measuring beats a constant: the nav loses tabs when a role lacks
 * a scope, and its bottom pad is `env(safe-area-inset-bottom)`, which differs
 * per device and is 0 in the browser but ~34px in the installed PWA.
 */
function usePublishNavHeight(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--app-nav-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--app-nav-h");
    };
  }, [ref]);
}

export function MobileBottomNav() {
  const { user, memberships, switchTenant, signOut } = useAuth();
  const { theme, toggle } = useThemeMode();
  const navigate = useNavigate();
  const [propoOpen, setPropoOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { groups } = useNavGroups();
  const pendingCount = usePendingCount();
  const navRef = useRef<HTMLElement>(null);
  usePublishNavHeight(navRef);

  if (!user) return null;

  const base = `/${user.role.toLowerCase()}`;
  const view = (user.view as UserView | undefined) ?? "agent";
  const isAdminView = view === "admin" || view === "admin-dev";
  const scopes = user.adminScope ?? [];
  const allow = (scope?: string) => !scope || scopes.length === 0 || scopes.includes(scope);
  // Propo (agent pipeline) is backend ADMIN-only.
  const canPropo = isAdminView && allow("agent");

  const go = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* z-50 so transient bottom-anchored chrome (the iOS install nudge) can
          never bury the only navigation this shell has. */}
      <nav
        ref={navRef}
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 px-3.5 pt-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex max-w-md items-center justify-around rounded-[2rem] border border-border bg-card px-2 py-2 shadow-[0_6px_26px_rgba(0,0,0,0.18)]">
          <NavTab to={base} end icon={Home} label="Inicio" />
          {allow("crm") && <NavTab to={`${base}/bandeja`} icon={Users} label="CRM" />}
          {canPropo && (
            <div className="flex flex-1 flex-col items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPropoOpen(true)}
                aria-label="Abrir Propo"
                className="-mt-7 flex size-[52px] items-center justify-center rounded-full bg-foreground text-background shadow-lg transition active:scale-90"
              >
                <Sparkles className="size-6" />
              </button>
              <span className="-mt-1 text-[11px] font-bold text-foreground">Propo</span>
            </div>
          )}
          {allow("productividad") && (
            <NavTab to={`${base}/calendario`} icon={CalendarDays} label="Agenda" />
          )}
          {/* Everything the sidebar can reach lives behind this tab. Without
              it the phone shell could only open whatever the four tabs and the
              home tiles hardcoded, stranding 13 routes at URL-only. */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label={pendingCount > 0 ? `Más · ${pendingCount} pendientes` : "Más"}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-1 text-muted-foreground"
          >
            <LayoutGrid className="size-[22px]" strokeWidth={1.8} />
            {pendingCount > 0 && (
              <span
                aria-hidden
                className="absolute right-[calc(50%-16px)] top-0 size-2 rounded-full bg-primary"
              />
            )}
            <span className="text-[11px] font-medium">Más</span>
          </button>
        </div>
      </nav>

      {canPropo && propoOpen && <AgentOverlay onClose={() => setPropoOpen(false)} />}

      <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="Todo">
        <div className="mt-3 flex items-center gap-3.5 pb-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-foreground">
            {initials(user.fullName)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold tracking-tight text-foreground">
              {user.fullName}
            </div>
            <div className="truncate text-sm capitalize text-muted-foreground">
              {user.role.toLowerCase()}
            </div>
          </div>
        </div>

        {/* The full destination tree, straight from the shared nav config —
            the same groups the desktop sidebar renders. Two columns because a
            24-item single-column list turns into a scroll marathon on a phone. */}
        {groups.map((group, idx) => (
          <div key={group.label ?? `g-${idx}`} className="border-t border-border py-2.5">
            {group.label && (
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
            )}
            <div className="grid grid-cols-2 gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge = item.badge === "pending" && pendingCount > 0 ? pendingCount : null;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-2.5 text-left transition active:scale-[0.98] active:bg-secondary"
                  >
                    <Icon
                      className="size-[18px] shrink-0 text-muted-foreground"
                      strokeWidth={1.9}
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                      {item.label}
                    </span>
                    {badge !== null && <Pill tone="accent">{badge}</Pill>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {memberships.length > 1 && (
          <div className="border-t border-border py-2">
            <div className="px-1 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Espacio de trabajo
            </div>
            {memberships.map((m) => {
              const active = m.tenantId === user.tenantId;
              return (
                <button
                  key={m.tenantId}
                  type="button"
                  onClick={() => {
                    if (!active) void switchTenant(m.tenantId);
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: `hsl(${hueForTenant(m.tenantId)} 42% 60%)` }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                    {m.tenantName ?? m.tenantSlug ?? m.tenantId}
                  </span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="border-t border-border py-1">
          <SheetItem
            icon={theme === "dark" ? Moon : Sun}
            label={theme === "dark" ? "Modo oscuro" : "Modo claro"}
            onClick={toggle}
          />
          {isAdminView && (
            <SheetItem
              icon={Settings}
              label="Configuración"
              onClick={() => go("/admin/settings")}
            />
          )}
        </div>

        <div className="border-t border-border pt-1">
          <SheetItem
            icon={LogOut}
            label="Cerrar sesión"
            onClick={() => {
              setMoreOpen(false);
              signOut();
            }}
            destructive
          />
        </div>
      </BottomSheet>
    </>
  );
}

function SheetItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 py-3 text-left text-[15px] font-medium",
        destructive ? "text-destructive" : "text-foreground",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.9} />
      {label}
    </button>
  );
}
