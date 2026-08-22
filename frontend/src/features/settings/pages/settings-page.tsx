import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Blend,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Palette,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ErrorState,
  FOCUS_RING,
  PageSkeleton,
  Pill,
  ResponsiveSheet,
  Row,
  SectionLabel,
  Segmented,
  TOUCH_TARGET_COARSE,
  TOUCH_TARGET_HIT_AREA,
  TOUCH_TARGET_ROW,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDevSchema, setDevSchema } from "@shared/api/http";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { settingsApi } from "../api/settings-api";
import { AvatarUploader } from "../components/avatar-uploader";
import { NotificationsCard } from "../components/notifications-card";
import { usePageTitle } from "@app/page-meta";
import { prefetchRoute } from "@shared/lib/route-chunks";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { buildSettingsShortcuts, filterByDev, filterByScope } from "@layouts/nav-items";

const PAPER_OPTIONS = [
  { value: "A4", label: "A4", detail: "210×297 mm" },
  { value: "LETTER", label: "Carta", detail: "8.5×11 in" },
  { value: "LEGAL", label: "Legal", detail: "8.5×14 in" },
  { value: "OFICIO_CL", label: "Oficio CL", detail: "216×330 mm" },
];

// Workspace brand accents (drive the UI accent for this tenant).
const BRAND_SWATCHES = [
  "#BE6E7D",
  "#2E6B52",
  "#3B5BDB",
  "#7A3FB0",
  "#C2410C",
  "#0F6E8C",
  "#A11D4B",
  "#B0560F",
];

/** Leading icon tile used across the settings rows. */
function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground">
      {children}
    </span>
  );
}

/**
 * Icon + title + subtitle + trailing control. This exact block was written
 * twice per section — once inside a DesktopCard, once inside a mobile Row —
 * with identical Spanish copy in both, so a wording change had to be made in
 * two places or the two layouts disagreed.
 */
function SettingLine({
  icon: Icon,
  title,
  sub,
  right,
  className,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <RowIcon>
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </RowIcon>
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold leading-tight text-foreground">{title}</div>
        <div className="text-[13px] text-muted-foreground">{sub}</div>
      </div>
      {right}
    </div>
  );
}

/** Desktop section card — a titled, bordered container for one settings group. */
function DesktopCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <h2 className="border-b border-border px-5 py-3.5 text-sm font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * The destinations that used to be permanent nav entries.
 *
 * Importar, Visitantes, Teléfonos, Usuarios, Workflows, Costo and Tenants are
 * monthly-at-most tasks; as six top-level nav items they carried the same
 * weight as CRM and made the tree something to memorise rather than read. They
 * live here now, filtered by the same scope and dev rules the nav applied, so a
 * restricted admin still cannot see what they cannot open.
 */
function AdminShortcuts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const agentName = useAgentName();
  const items = filterByDev(
    filterByScope([{ items: buildSettingsShortcuts(agentName) }], user?.adminScope ?? []),
    !!user?.isDevAdmin,
  ).flatMap((g) => g.items);

  if (items.length === 0) return null;

  return (
    // Every destination here is a lazy chunk, and this grid IS the moment of
    // intent — a broker looking at it is about to open one. Warming on mount
    // rather than on hover, because on a phone there is no hover and these are
    // the six slowest destinations in the app.
    <div
      ref={() => items.forEach((i) => prefetchRoute(i.path))}
      className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-1"
    >
      {items.map((item) => (
        <button
          key={item.path}
          type="button"
          onMouseEnter={() => prefetchRoute(item.path)}
          onFocus={() => prefetchRoute(item.path)}
          onClick={() => navigate(item.path)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-secondary active:scale-[0.98]",
            TOUCH_TARGET_ROW,
          )}
        >
          <RowIcon>
            <item.icon className="size-[18px]" strokeWidth={1.8} />
          </RowIcon>
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
            {item.label}
          </span>
          {item.devOnly && (
            <span className="rounded bg-warning/20 px-1 text-[11px] font-bold uppercase tracking-wide text-warning">
              dev
            </span>
          )}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

export function SettingsPage() {
  usePageTitle("Configuración");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();
  // The SAME key the branding provider uses, not a second one for the same
  // endpoint. `["settings","tenant"]` and `["tenant","me"]` both called
  // `GET /v1/tenants/me`, and React Query cannot dedupe two keys — so opening
  // Configuración fetched the tenant twice, in a shell that has already fetched
  // it once. The save mutation invalidating both was the tell.
  const tenantQ = useQuery({
    queryKey: ["tenant", "me"],
    queryFn: () => settingsApi.getTenant(),
    staleTime: 5 * 60_000,
  });
  const meQ = useQuery({
    queryKey: ["settings", "me"],
    queryFn: () => settingsApi.getMe(),
  });

  const [agentName, setAgentName] = useState("");
  const [paperSize, setPaperSize] = useState("A4");
  const [paperOpen, setPaperOpen] = useState(false);
  const [brandColor, setBrandColor] = useState<string | null>(null);
  // How much of the brand bleeds into every surface. index.css writes each
  // surface token as `color-mix(… var(--accent-brand) var(--tint), <neutral>)`,
  // so this single number tints backgrounds, cards, borders and the sidebar
  // together. It shipped hard-coded at 0%, which is why the palette machinery
  // existed but the app looked grey whatever brand colour was picked.
  const [brandTint, setBrandTint] = useState(0);

  useEffect(() => {
    if (tenantQ.data) {
      setAgentName(tenantQ.data.settings.ai_assistant_name);
      setPaperSize(tenantQ.data.settings.default_paper_size);
      setBrandColor(tenantQ.data.settings.brand_color ?? null);
      setBrandTint(tenantQ.data.settings.brand_tint ?? 0);
    }
  }, [tenantQ.data]);

  const save = useMutation({
    mutationFn: () =>
      settingsApi.updateTenant({
        ai_assistant_name: agentName.trim() || "Anita",
        default_paper_size: paperSize,
        brand_color: brandColor ?? "",
        brand_tint: brandTint,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", "me"] });
      toast.success("Configuración guardada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar"),
  });

  // Gated on the tenant only. `meQ` feeds one card (the profile), and blocking
  // the whole page on it meant Configuración showed a full-page skeleton until
  // BOTH requests landed — two serial round trips behind a cold chunk, which is
  // the "se congela como 5 segundos" report.
  if (tenantQ.isPending) {
    return (
      <PageLayout width="md" noPadding>
        <PageSkeleton variant="list" count={5} className="pt-6" />
      </PageLayout>
    );
  }

  // The form is hydrated from `tenantQ.data`. Without it the inputs keep their
  // `useState` defaults, so rendering the form here would let Guardar overwrite
  // the real tenant settings with those defaults.
  if (!tenantQ.data) {
    return (
      <PageLayout width="md" noPadding>
        <div className="px-5 pt-6">
          <ErrorState
            message="No se pudo cargar la configuración del workspace. Reintenta antes de editar."
            error={tenantQ.error}
            onRetry={() => tenantQ.refetch()}
          />
        </div>
      </PageLayout>
    );
  }

  const paper = PAPER_OPTIONS.find((o) => o.value === paperSize);

  // ---- Shared control fragments (used by both layouts) ----
  const agentNameInput = (
    <input
      value={agentName}
      onChange={(e) => setAgentName(e.target.value)}
      placeholder="Anita"
      aria-label="Nombre del agente"
      className={`h-9 w-28 rounded-lg border border-border bg-secondary px-3 text-right text-[15px] font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground ${FOCUS_RING}`}
    />
  );

  /** 0 keeps the neutrals neutral; past ~10% the greys visibly take the brand on. */
  const brandTintPicker = (
    <div className="flex gap-1 rounded-full bg-muted p-1">
      {[0, 3, 6, 9].map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setBrandTint(t)}
          className={cn(
            "min-w-14 rounded-full py-1.5 text-xs font-semibold transition",
            TOUCH_TARGET_HIT_AREA,
            brandTint === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {t === 0 ? "Ninguno" : `${t}%`}
        </button>
      ))}
    </div>
  );

  const brandSwatches = (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => setBrandColor(null)}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border-2 text-[11px] font-bold transition",
          TOUCH_TARGET_HIT_AREA,
          brandColor === null
            ? "border-foreground text-foreground"
            : "border-border text-muted-foreground",
        )}
      >
        Auto
      </button>
      {BRAND_SWATCHES.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => setBrandColor(hex)}
          aria-label={`Color ${hex}`}
          style={{ background: hex }}
          className={cn(
            "size-9 rounded-full ring-2 ring-offset-2 ring-offset-background transition",
            TOUCH_TARGET_HIT_AREA,
            brandColor === hex ? "ring-foreground" : "ring-transparent",
          )}
        />
      ))}
    </div>
  );

  const paperSheet = (
    <ResponsiveSheet open={paperOpen} onOpenChange={setPaperOpen} title="Tamaño de página">
      <div className="mt-3">
        {PAPER_OPTIONS.map((o) => {
          const active = o.value === paperSize;
          return (
            <Row
              key={o.value}
              title={o.label}
              sub={o.detail}
              onClick={() => {
                setPaperSize(o.value);
                setPaperOpen(false);
              }}
              divider={o.value !== PAPER_OPTIONS[PAPER_OPTIONS.length - 1]?.value}
              right={
                active ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-foreground">
                    <Check className="size-3.5 text-background" strokeWidth={3} />
                  </span>
                ) : undefined
              }
            />
          );
        })}
      </div>
    </ResponsiveSheet>
  );

  // ---- One definition per section, two shells ---------------------------
  // Every section below used to exist twice, with the same strings, icons and
  // handlers in each branch. The layouts genuinely differ (a two-column card
  // grid vs a single-column list), so the SHELL branches — the content does not.
  const sections: { key: string; title: string; body: React.ReactNode }[] = [
    {
      key: "administracion",
      title: "Administración",
      body: <AdminShortcuts />,
    },
    {
      key: "perfil",
      title: "Perfil",
      // Three states, not two: the page no longer waits for this request, so
      // "no data yet" now genuinely happens and must not read as a failure.
      body: meQ.data ? (
        <AvatarUploader user={meQ.data} />
      ) : meQ.isPending ? (
        <PageSkeleton variant="list" count={1} />
      ) : (
        <ErrorState
          compact
          message="No se pudo cargar tu perfil."
          error={meQ.error}
          onRetry={() => meQ.refetch()}
        />
      ),
    },
    {
      key: "agente",
      title: "Agente IA",
      body: (
        <>
          <SettingLine
            icon={Sparkles}
            title="Nombre del agente"
            sub="Visible en sidebar, chat, pendientes y notificaciones."
            right={agentNameInput}
          />
          {/* The whole line is the target, not just the chevron: a 16px arrow
              is a hit area nobody finds on a phone. */}
          <button
            type="button"
            onClick={() => navigate("/admin/settings/propo")}
            className={cn(
              "-mx-2 mt-3 flex w-[calc(100%+1rem)] items-center rounded-xl px-2 py-2 text-left transition hover:bg-secondary active:scale-[0.99]",
              TOUCH_TARGET_ROW,
              FOCUS_RING,
            )}
          >
            <SettingLine
              icon={ShieldCheck}
              title="Permisos"
              sub={`Qué puede hacer ${agentName || "el agente"} sin que nadie lo revise.`}
              right={<ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
              className="w-full"
            />
          </button>
        </>
      ),
    },
    {
      key: "marca",
      title: "Marca",
      body: (
        <>
          <SettingLine
            icon={Palette}
            title="Color de la empresa"
            sub="Acento de la interfaz para este workspace."
          />
          <div className="mt-4">{brandSwatches}</div>
          <SettingLine
            icon={Blend}
            title="Intensidad del tinte"
            sub="Cuánto del color de marca tiñe fondos, tarjetas y bordes."
          />
          <div className="mt-3">{brandTintPicker}</div>
        </>
      ),
    },
    {
      key: "notificaciones",
      title: "Notificaciones",
      body: <NotificationsCard />,
    },
    {
      key: "documentos",
      title: "Documentos",
      body: (
        <SettingLine
          icon={FileText}
          title="Tamaño de página"
          sub="Se aplica al generar PDFs desde escaneos."
          right={
            <button
              type="button"
              onClick={() => setPaperOpen(true)}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-[15px] font-semibold text-foreground",
                TOUCH_TARGET_COARSE,
                FOCUS_RING,
              )}
            >
              {paper?.label ?? paperSize}
            </button>
          }
        />
      ),
    },
    ...(meQ.data?.admin_scope?.length
      ? [
          {
            key: "permisos",
            title: "Permisos",
            body: (
              <div className="flex items-start gap-3">
                <RowIcon>
                  <Shield className="size-[18px]" strokeWidth={1.8} />
                </RowIcon>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold leading-tight text-foreground">
                    Scope admin
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {meQ.data?.admin_scope?.map((sc) => (
                      <Pill key={sc} tone="neutral">
                        {sc}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            ),
          },
        ]
      : []),
  ];

  const saveButton = (
    <Button
      onClick={() => save.mutate()}
      disabled={save.isPending}
      variant="ink"
      size={isDesktop ? "default" : "block"}
      className="gap-2"
    >
      {save.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />}
      Guardar
    </Button>
  );

  if (isDesktop) {
    return (
      <PageLayout width="md" noPadding className="pb-16 lg:max-w-5xl lg:px-8 lg:pt-7">
        <PageHeader title="Configuración" actions={saveButton} className="mb-0" />
        <div className="mt-7 grid grid-cols-2 items-start gap-6">
          {sections.map((sec) => (
            <DesktopCard
              key={sec.key}
              title={sec.title}
              className={cn(
                sec.key === "notificaciones" && "overflow-hidden",
                // The destination grid is the reason to open this page; give it
                // the full width so its rows are not two per line at 190px.
                sec.key === "administracion" && "col-span-2",
              )}
            >
              <div className={sec.key === "notificaciones" ? "-mx-5 -my-5" : undefined}>
                {sec.body}
              </div>
            </DesktopCard>
          ))}
        </div>
        {paperSheet}
      </PageLayout>
    );
  }

  return (
    // No bottom-nav pad here — the shell's <main> already clears --app-nav-h.
    <PageLayout width="md" noPadding className="pb-6">
      {/* No painted title: the shell's top bar already reads "Configuración"
          from usePageTitle above. This page printed it a second time, directly
          underneath. */}

      {sections.map((sec) => (
        <div key={sec.key}>
          <SectionLabel className="mb-2 mt-7 px-5 lg:px-0">{sec.title}</SectionLabel>
          <div className={sec.key === "notificaciones" ? undefined : "px-5"}>{sec.body}</div>
        </div>
      ))}

      {import.meta.env.DEV && (
        <div className="mt-7 px-5">
          <SectionLabel className="mb-2">Desarrollo</SectionLabel>
          <DevSchemaSwitch />
        </div>
      )}

      <div className="mt-8 px-5">{saveButton}</div>
      {paperSheet}
    </PageLayout>
  );
}

/**
 * Flips the schema the API talks to for this browser. Dev builds only, and the
 * backend only honours the header when APP_ENV=development — see
 * app/core/middleware/dev_schema.py. `propos_test` has no RLS and no profiles,
 * so most screens will look empty there; that is the mirror behaving correctly,
 * not a bug.
 */
function DevSchemaSwitch() {
  const current = getDevSchema() ?? "public";
  return (
    <Segmented
      className="px-0"
      items={[
        { id: "public", label: "public" },
        { id: "propos_test", label: "propos_test" },
      ]}
      value={current}
      onChange={(id) => {
        setDevSchema(id === "public" ? null : id);
        window.location.reload();
      }}
    />
  );
}

// Default export so the router can code-split this page with React.lazy.
export default SettingsPage;
