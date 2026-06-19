import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, Palette, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet, Pill, Row, SectionLabel } from "@shared/ui";
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

export function SettingsPage() {
  const qc = useQueryClient();
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

  if (tenantQ.isLoading || meQ.isLoading) {
    return (
      <PageLayout width="md" noPadding>
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  const paper = PAPER_OPTIONS.find((o) => o.value === paperSize);

  return (
    <PageLayout width="md" noPadding className="pb-28">
      <div className="px-5 pt-5 pb-1">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Configuración
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Tu perfil, el agente IA y los documentos.
        </p>
      </div>

      {meQ.data ? <AvatarUploader user={meQ.data} /> : null}

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
        right={
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Anita"
            aria-label="Nombre del agente"
            className="h-9 w-28 rounded-lg border border-border bg-secondary px-3 text-right text-[15px] font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-line-strong focus-visible:outline-none"
          />
        }
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
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setBrandColor(null)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border-2 text-[10px] font-bold transition",
              brandColor === null ? "border-foreground text-foreground" : "border-border text-muted-foreground",
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

      {/* Paper size picker */}
      <BottomSheet open={paperOpen} onOpenChange={setPaperOpen} title="Tamaño de página">
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
      </BottomSheet>
    </PageLayout>
  );
}
