import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Check,
  Home,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  Sun,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { useThemeMode } from "@core/theme/theme-provider";
import { hueForTenant } from "@core/theme/tenant-accent";
import { AgentOverlay } from "@features/agent/components/agent-overlay";
import { BottomSheet } from "@shared/ui";
import { cn } from "@/lib/utils";
import type { UserView } from "@shared/types/auth";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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
              "text-[10.5px]",
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

export function MobileBottomNav() {
  const { user, memberships, switchTenant, signOut } = useAuth();
  const { theme, toggle } = useThemeMode();
  const navigate = useNavigate();
  const [propoOpen, setPropoOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  if (!user) return null;

  const base = `/${user.role.toLowerCase()}`;
  const view = (user.view as UserView | undefined) ?? "agent";
  const isAdminView = view === "admin" || view === "admin-dev";
  const scopes = user.adminScope ?? [];
  const allow = (scope?: string) => !scope || scopes.length === 0 || scopes.includes(scope);
  // Propo (agent pipeline) is backend ADMIN-only.
  const canPropo = isAdminView && allow("agent");

  const go = (path: string) => {
    setAccountOpen(false);
    navigate(path);
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3.5 pt-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
              <span className="-mt-1 text-[10.5px] font-bold text-foreground">Propo</span>
            </div>
          )}
          {allow("productividad") && (
            <NavTab to={`${base}/calendario`} icon={CalendarDays} label="Agenda" />
          )}
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-1 text-muted-foreground"
          >
            <User className="size-[22px]" strokeWidth={1.8} />
            <span className="text-[10.5px] font-medium">Cuenta</span>
          </button>
        </div>
      </nav>

      {canPropo && propoOpen && <AgentOverlay onClose={() => setPropoOpen(false)} />}

      <BottomSheet open={accountOpen} onOpenChange={setAccountOpen} title="Cuenta">
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
                    setAccountOpen(false);
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
              setAccountOpen(false);
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
