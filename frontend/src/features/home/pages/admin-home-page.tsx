import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckSquare,
  FileText,
  Inbox,
  MessageCircle,
  Mic,
  Receipt,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { hueForTenant } from "@core/theme/tenant-accent";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import { UfButton } from "@features/uf/components/uf-button";
import { AgentOverlay } from "@features/agent/components/agent-overlay";
import { BottomSheet, Row, SectionLabel, WorkspacePill } from "@shared/ui";
import { cn } from "@/lib/utils";

interface Tile {
  to: string;
  label: string;
  icon: LucideIcon;
  scope?: string;
  /** routes that only exist for the ADMIN role */
  adminOnly?: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function ServiceTile({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  const Icon = tile.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[88px] flex-col items-start justify-between rounded-2xl bg-secondary p-3 text-left transition active:scale-[0.97]"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-background shadow-sm">
        <Icon className="size-[19px] text-foreground" strokeWidth={1.9} />
      </span>
      <span className="text-[13px] font-semibold text-foreground">{tile.label}</span>
    </button>
  );
}

export function AdminHomePage() {
  const { user, memberships, switchTenant } = useAuth();
  const agentName = useAgentName();
  const navigate = useNavigate();
  const [wsOpen, setWsOpen] = useState(false);
  const [propoOpen, setPropoOpen] = useState(false);
  const [propoMode, setPropoMode] = useState<"voice" | "chat">("chat");

  const role = (user?.role ?? "ADMIN").toLowerCase();
  const base = `/${role}`;
  const isAdmin = role === "admin";
  const firstName = (user?.fullName ?? "").split(" ")[0] || "";
  const scope = user?.adminScope ?? [];
  const allow = (s?: string) => !s || scope.length === 0 || scope.includes(s);
  // Propo (agent pipeline) is backend ADMIN-only.
  const canPropo = isAdmin && allow("agent");
  const tenantName =
    memberships.find((m) => m.tenantId === user?.tenantId)?.tenantName ?? "Workspace";

  const { data: contacts } = useContacts({ limit: 50 });
  const recent = (contacts ?? []).slice(0, 4);

  const tiles: Tile[] = [
    { to: `${base}/bandeja`, label: "CRM", icon: Users, scope: "crm" },
    { to: `${base}/calendario`, label: "Agenda", icon: CalendarDays, scope: "productividad" },
    { to: `${base}/tareas`, label: "Tareas", icon: CheckSquare, scope: "productividad" },
    { to: `${base}/notas`, label: "Notas", icon: StickyNote, scope: "productividad" },
    { to: `${base}/client-inbox`, label: "WhatsApp", icon: MessageCircle, scope: "inbox" },
    { to: `${base}/documents`, label: "Docs", icon: FileText, scope: "documents" },
    { to: `${base}/pendientes`, label: "Pendientes", icon: Inbox, scope: "pendientes" },
    { to: "/admin/properties", label: "Propiedades", icon: Building2, adminOnly: true },
    { to: "/admin/finanzas", label: "Finanzas", icon: Receipt, scope: "finanzas", adminOnly: true },
  ].filter((t) => allow(t.scope) && (!t.adminOnly || isAdmin));

  return (
    <div className="mx-auto w-full max-w-2xl pb-6 lg:max-w-none lg:px-8 lg:pt-2">
      {/* header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 lg:px-0 lg:pt-4">
        <WorkspacePill label={tenantName} onClick={() => setWsOpen(true)} />
        <div className="flex items-center gap-2">
          <UfButton />
          <button
            type="button"
            aria-label="Notificaciones"
            className="flex size-10 items-center justify-center rounded-full bg-secondary text-foreground transition active:scale-90"
          >
            <Bell className="size-[18px]" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {/* On mobile these blocks stay a single flow column (wrappers are
          display:contents). On desktop they reflow into a two-column bento. */}
      <div className="contents lg:mt-2 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        {/* Left: greeting + Propo command bar + "Tu día" panel */}
        <div className="contents lg:col-span-4 lg:flex lg:flex-col lg:gap-5">
          <h1 className="px-5 text-[25px] font-bold leading-tight tracking-tight text-foreground lg:px-0 lg:text-[32px]">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>

          {/* Propo command bar */}
          {canPropo && (
            <div className="flex gap-2.5 px-5 pt-4 pb-5 lg:px-0 lg:py-0">
              <button
                type="button"
                onClick={() => {
                  setPropoMode("chat");
                  setPropoOpen(true);
                }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-left transition active:scale-[0.99]"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Sparkles className="size-4" />
                </span>
                <span className="truncate text-[15px] font-medium text-muted-foreground">
                  Pídele algo a {agentName}…
                </span>
              </button>
              <button
                type="button"
                aria-label={`Hablar con ${agentName}`}
                onClick={() => {
                  setPropoMode("voice");
                  setPropoOpen(true);
                }}
                className="flex w-12 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background transition active:scale-95"
              >
                <Mic className="size-[21px]" strokeWidth={1.9} />
              </button>
            </div>
          )}

          {/* "Tu día" — desktop-only summary panel */}
          <div className="hidden lg:block">
            <div className="rounded-2xl bg-secondary p-5">
              <p className="text-sm font-semibold text-muted-foreground">Tu día</p>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                {recent.length > 0
                  ? `Tenés ${(contacts ?? []).length} ${
                      (contacts ?? []).length === 1 ? "persona" : "personas"
                    } en tu CRM. Retomá el seguimiento desde abajo.`
                  : "Empezá agregando personas a tu CRM para hacer seguimiento."}
              </p>
              {allow("crm") && (
                <button
                  type="button"
                  onClick={() => navigate(`${base}/personas`)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:underline"
                >
                  <Users className="size-4" strokeWidth={1.9} />
                  Ver CRM
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: service tiles + recent personas */}
        <div className="contents lg:col-span-8 lg:flex lg:flex-col lg:gap-6">
          {/* Service tiles */}
          <div className="grid grid-cols-4 gap-2.5 px-5 pb-6 lg:px-0 lg:pb-0">
            {tiles.map((t) => (
              <ServiceTile key={t.to} tile={t} onClick={() => navigate(t.to)} />
            ))}
          </div>

          {/* Recent contacts */}
          {allow("crm") && (
            <div className="contents lg:block lg:rounded-2xl lg:border lg:border-border lg:py-2">
              <SectionLabel action="Ver CRM" onAction={() => navigate(`${base}/personas`)}>
                Personas recientes
              </SectionLabel>
              <div className="mt-2">
                {recent.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                    Aún no hay contactos.
                  </p>
                ) : (
                  recent.map((c, i) => (
                    <Row
                      key={c.id}
                      onClick={() => navigate(`${base}/personas/${c.id}`)}
                      divider={i < recent.length - 1}
                      left={
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                          {c.full_name
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      }
                      title={c.full_name}
                      sub={[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Workspace switcher */}
      <BottomSheet
        open={wsOpen}
        onOpenChange={setWsOpen}
        title="Espacio de trabajo"
        description="Cada empresa trabaja sin mezclar información."
      >
        <div className="mt-3">
          {memberships.map((m) => {
            const active = m.tenantId === user?.tenantId;
            return (
              <button
                key={m.tenantId}
                type="button"
                onClick={() => {
                  if (!active) void switchTenant(m.tenantId);
                  setWsOpen(false);
                }}
                className={cn(
                  "mb-2 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]",
                  active ? "border-foreground" : "border-border",
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `hsl(${hueForTenant(m.tenantId)} 42% 55%)` }}
                >
                  <Building2 className="size-5 text-white" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold tracking-tight text-foreground">
                    {m.tenantName ?? m.tenantSlug ?? m.tenantId}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {m.role.toLowerCase()}
                  </span>
                </span>
                {active && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-foreground">
                    <Check className="size-3.5 text-background" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {canPropo && propoOpen && (
        <AgentOverlay onClose={() => setPropoOpen(false)} initialMode={propoMode} />
      )}
    </div>
  );
}
