import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, Palette, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ErrorState,
  PageSkeleton,
  Pill,
  ResponsiveSheet,
  Row,
  SectionLabel,
  FOCUS_RING,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageLayout } from "@shared/components/page-layout";
import { settingsApi } from "../api/settings-api";
import { AvatarUploader } from "../components/avatar-uploader";
import { NotificationsCard } from "../components/notifications-card";

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
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      <h2 className="border-b border-border px-5 py-3.5 text-sm font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function SettingsPage() {
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
            message="No se pudo cargar la configuración del workspace. Reintentá antes de editar."
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
          "flex size-9 items-center justify-center rounded-full border-2 text-[10px] font-bold transition",
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

  // ---- Desktop: wide, sectioned settings in a two-column grid ----
  if (isDesktop) {
    return (
      <PageLayout width="md" noPadding className="pb-16 lg:max-w-5xl lg:px-8 lg:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-bold leading-tight tracking-tight text-foreground">
              Configuración
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu perfil, el agente IA y los documentos.
            </p>
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            variant="ink"
            className="gap-2"
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />}
            Guardar
          </Button>
        </div>

        <div className="mt-7 grid grid-cols-2 items-start gap-6">
          {/* Perfil */}
          {meQ.data ? (
            <DesktopCard title="Perfil">
              <AvatarUploader user={meQ.data} />
            </DesktopCard>
          ) : (
            <DesktopCard title="Perfil">
              <ErrorState
                compact
                message="No se pudo cargar tu perfil."
                error={meQ.error}
                onRetry={() => meQ.refetch()}
              />
            </DesktopCard>
          )}

          {/* Agente IA */}
          <DesktopCard title="Agente IA">
            <div className="flex items-center gap-3">
              <RowIcon>
                <Sparkles className="size-[18px]" strokeWidth={1.8} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold leading-tight text-foreground">
                  Nombre del agente
                </div>
                <div className="text-[13px] text-muted-foreground">
                  Visible en sidebar, chat, pendientes y notificaciones.
                </div>
              </div>
              {agentNameInput}
            </div>
          </DesktopCard>

          {/* Marca */}
          <DesktopCard title="Marca">
            <div className="flex items-center gap-3">
              <RowIcon>
                <Palette className="size-[18px]" strokeWidth={1.8} />
              </RowIcon>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold leading-tight text-foreground">
                  Color de la empresa
                </div>
                <div className="text-[13px] text-muted-foreground">
                  Acento de la interfaz para este workspace.
                </div>
              </div>
            </div>
            <div className="mt-4">{brandSwatches}</div>
          </DesktopCard>

          {/* Documentos */}
          <DesktopCard title="Documentos">
            <Row
              left={
                <RowIcon>
                  <FileText className="size-[18px]" strokeWidth={1.8} />
                </RowIcon>
              }
              title="Tamaño de página"
              sub="Se aplica al generar PDFs desde escaneos."
              onClick={() => setPaperOpen(true)}
              divider={false}
              className="-mx-5 rounded-xl"
              right={
                <span className="flex items-center gap-1 text-[15px] font-semibold text-foreground">
                  {paper?.label ?? paperSize}
                </span>
              }
            />
          </DesktopCard>

          {/* Notificaciones */}
          <DesktopCard title="Notificaciones" className="overflow-hidden">
            <div className="-mx-5 -my-5">
              <NotificationsCard />
            </div>
          </DesktopCard>

          {/* Permisos */}
          {meQ.data && meQ.data.admin_scope.length > 0 && (
            <DesktopCard title="Permisos">
              <div className="flex items-start gap-3">
                <RowIcon>
                  <Shield className="size-[18px]" strokeWidth={1.8} />
                </RowIcon>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold leading-tight text-foreground">
                    Scope admin
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {meQ.data.admin_scope.map((s) => (
                      <Pill key={s} tone="neutral">
                        {s}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            </DesktopCard>
          )}
        </div>

        {paperSheet}
      </PageLayout>
    );
  }

  // ---- Mobile: unchanged single-column flow ----
  return (
    // No bottom-nav pad here — the shell's <main> already clears --app-nav-h.
    <PageLayout width="md" noPadding className="pb-6">
      <div className="px-5 pt-5 pb-1">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Configuración
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Tu perfil, el agente IA y los documentos.
        </p>
      </div>

      {meQ.data ? (
        <AvatarUploader user={meQ.data} />
      ) : (
        <div className="px-5 pt-3">
          <ErrorState
            compact
            message="No se pudo cargar tu perfil."
            error={meQ.error}
            onRetry={() => meQ.refetch()}
          />
        </div>
      )}

      {/* Agente IA */}
      <SectionLabel className="mb-2 mt-2">Agente IA</SectionLabel>
      <Row
        left={
          <RowIcon>
            <Sparkles className="size-[18px]" strokeWidth={1.8} />
          </RowIcon>
        }
        title="Nombre del agente"
        sub="Visible en sidebar, chat, pendientes y notificaciones."
        divider={false}
        right={agentNameInput}
      />

      {/* Marca */}
      <SectionLabel className="mb-2 mt-7">Marca</SectionLabel>
      <div className="px-5">
        <div className="flex items-center gap-3">
          <RowIcon>
            <Palette className="size-[18px]" strokeWidth={1.8} />
          </RowIcon>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold leading-tight text-foreground">
              Color de la empresa
            </div>
            <div className="text-[13px] text-muted-foreground">
              Acento de la interfaz para este workspace.
            </div>
          </div>
        </div>
        <div className="mt-3">{brandSwatches}</div>
      </div>

      {/* Notificaciones */}
      <SectionLabel className="mb-2 mt-7">Notificaciones</SectionLabel>
      <NotificationsCard />

      {/* Documentos */}
      <SectionLabel className="mb-2 mt-7">Documentos</SectionLabel>
      <Row
        left={
          <RowIcon>
            <FileText className="size-[18px]" strokeWidth={1.8} />
          </RowIcon>
        }
        title="Tamaño de página"
        sub="Se aplica al generar PDFs desde escaneos."
        onClick={() => setPaperOpen(true)}
        divider={false}
        right={
          <span className="flex items-center gap-1 text-[15px] font-semibold text-foreground">
            {paper?.label ?? paperSize}
          </span>
        }
      />

      {/* Scope admin */}
      {meQ.data && meQ.data.admin_scope.length > 0 && (
        <>
          <SectionLabel className="mb-2 mt-7">Permisos</SectionLabel>
          <div className="flex items-start gap-3 px-5">
            <RowIcon>
              <Shield className="size-[18px]" strokeWidth={1.8} />
            </RowIcon>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold leading-tight text-foreground">
                Scope admin
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {meQ.data.admin_scope.map((s) => (
                  <Pill key={s} tone="neutral">
                    {s}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save CTA */}
      <div className="mt-8 px-5">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          variant="ink"
          size="block"
          className="gap-2"
        >
          {save.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />}
          Guardar
        </Button>
      </div>

      {paperSheet}
    </PageLayout>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default SettingsPage;
