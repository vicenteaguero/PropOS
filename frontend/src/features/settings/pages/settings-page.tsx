import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { settingsApi } from "../api/settings-api";
import { AvatarUploader } from "../components/avatar-uploader";

const PAPER_OPTIONS = [
  { value: "A4", label: "A4 (210×297 mm)" },
  { value: "LETTER", label: "Carta (8.5×11 in)" },
  { value: "LEGAL", label: "Legal (8.5×14 in)" },
  { value: "OFICIO_CL", label: "Oficio CL (216×330 mm)" },
];

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

  useEffect(() => {
    if (tenantQ.data) {
      setAgentName(tenantQ.data.settings.ai_assistant_name);
      setPaperSize(tenantQ.data.settings.default_paper_size);
    }
  }, [tenantQ.data]);

  const save = useMutation({
    mutationFn: () =>
      settingsApi.updateTenant({
        ai_assistant_name: agentName.trim() || "Anita",
        default_paper_size: paperSize,
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
      <PageLayout width="md">
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="md">
      <PageHeader
        title="Configuración"
        description="Identidad del agente IA, tamaño de página por defecto y tu perfil."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tu perfil</CardTitle>
          </CardHeader>
          <CardContent>
            {meQ.data ? <AvatarUploader user={meQ.data} /> : null}
            {meQ.data && meQ.data.admin_scope.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Scope admin:</span>
                {meQ.data.admin_scope.map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agente IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Nombre del agente</Label>
              <Input
                id="agent-name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Anita"
              />
              <p className="text-xs text-muted-foreground">
                Visible en sidebar, chat, pendientes y notificaciones.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="paper-size">Tamaño de página por defecto</Label>
              <select
                id="paper-size"
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PAPER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Se aplica al generar PDFs desde escaneos.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Guardar
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
