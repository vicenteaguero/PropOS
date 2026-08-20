import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, Palette, Shield, Sparkles } from "lucide-react";
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
  TOUCH_TARGET_COARSE,
  TOUCH_TARGET_HIT_AREA,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { settingsApi } from "../api/settings-api";
import { AvatarUploader } from "../components/avatar-uploader";
import { NotificationsCard } from "../components/notifications-card";
import { usePageTitle } from "@app/page-meta";

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
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
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

export function SettingsPage() {
  usePageTitle("Configuración");
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();
  const tenantQ = useQuery({
    queryKey: ["settings", "tenant"],
    queryFn: () => settingsApi.getTenant(),
  });
  const meQ = useQuery({
    queryKey: ["settings", "me"],
    queryFn: () => settingsApi.getMe(),
  });

  const [agentName, setAgentName] = useState("");
  const [paperSize, setPaperSize] = useState("A4");
  const [paperOpen, setPaperOpen] = useState(false);
  const [brandColor, setBrandColor] = useState<string | null>(null);

  useEffect(() => {
    if (tenantQ.data) {
      setAgentName(tenantQ.data.settings.ai_assistant_name);
      setPaperSize(tenantQ.data.settings.default_paper_size);
      setBrandColor(tenantQ.data.settings.brand_color ?? null);
    }
  }, [tenantQ.data]);

  const save = useMutation({
    mutationFn: () =>
      settingsApi.updateTenant({
        ai_assistant_name: agentName.trim() || "Anita",
        default_paper_size: paperSize,
        brand_color: brandColor ?? "",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "tenant"] });
      qc.invalidateQueries({ queryKey: ["tenant", "me"] });
      toast.success("Configuración guardada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar"),
  });

  if (tenantQ.isPending || meQ.isPending) {
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
      key: "perfil",
      title: "Perfil",
      body: meQ.data ? (
        <AvatarUploader user={meQ.data} />
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
        <SettingLine
          icon={Sparkles}
          title="Nombre del agente"
          sub="Visible en sidebar, chat, pendientes y notificaciones."
          right={agentNameInput}
        />
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
              className={sec.key === "notificaciones" ? "overflow-hidden" : undefined}
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
      <div className="px-5 pt-5 pb-1">
        <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-foreground">
          Configuración
        </h1>
      </div>

      {sections.map((sec) => (
        <div key={sec.key}>
          <SectionLabel className="mb-2 mt-7">{sec.title}</SectionLabel>
          <div className={sec.key === "notificaciones" ? undefined : "px-5"}>{sec.body}</div>
        </div>
      ))}

      <div className="mt-8 px-5">{saveButton}</div>
      {paperSheet}
    </PageLayout>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default SettingsPage;
