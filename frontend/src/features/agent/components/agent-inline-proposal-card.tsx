import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { useAcceptProposal, useRejectProposal } from "@features/pending/hooks/use-pending";
import { useQuery } from "@tanstack/react-query";
import { pendingApi } from "@features/pending/api/pending-api";
import { ProposalDisambiguationPicker } from "@features/pending/components/proposal-disambiguation-picker";

interface Props {
  proposalId: string;
}

const KIND_LABELS: Record<string, string> = {
  propose_create_person: "Crear persona",
  propose_update_person: "Actualizar persona",
  propose_log_interaction: "Registrar interacción",
  propose_create_task: "Crear tarea",
  propose_create_event: "Agendar evento",
  propose_log_transaction: "Registrar transacción",
  propose_create_campaign: "Crear campaña",
  propose_create_organization: "Crear organización",
  propose_add_note: "Agregar nota",
  propose_create_property: "Crear propiedad",
  propose_attach_photos_to_property: "Adjuntar fotos a propiedad",
  propose_create_document_from_photos: "Crear documento con fotos",
};

// Spanish labels for payload keys so the card never leaks raw English field names.
const FIELD_LABELS_ES: Record<string, string> = {
  full_name: "Nombre",
  first_name: "Nombre",
  last_name: "Apellido",
  phone: "Teléfono",
  email: "Email",
  rut: "RUT",
  address: "Dirección",
  type: "Tipo",
  role: "Rol",
  stage: "Etapa",
  status: "Estado",
  title: "Título",
  body: "Detalle",
  note: "Nota",
  notes: "Notas",
  occurred_at: "Fecha",
  starts_at: "Inicio",
  ends_at: "Fin",
  due_at: "Vence",
  due_date: "Vence",
  amount: "Monto",
  amount_cents: "Monto",
  currency: "Moneda",
  direction: "Tipo",
  category: "Categoría",
  channel: "Canal",
  subject: "Asunto",
  interaction_type: "Tipo",
  comuna: "Comuna",
  price_clp: "Precio",
  bedrooms: "Dormitorios",
  bathrooms: "Baños",
  area_m2: "m²",
  area_sqm: "m²",
  listing_kind: "Operación",
  year_built: "Año",
  description: "Descripción",
  contact_name: "Contacto",
  property_title: "Propiedad",
};
const fieldLabel = (k: string) => FIELD_LABELS_ES[k] ?? k;

export function AgentInlineProposalCard({ proposalId }: Props) {
  const [editing, setEditing] = useState(false);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const accept = useAcceptProposal();
  const reject = useRejectProposal();

  const { data: proposal, isLoading } = useQuery({
    queryKey: ["pending", "detail", proposalId],
    queryFn: () => pendingApi.get(proposalId),
    refetchInterval: false,
  });

  if (isLoading || !proposal) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando propuesta…
        </CardContent>
      </Card>
    );
  }

  const summary =
    (proposal.payload?.summary_es as string) || KIND_LABELS[proposal.kind] || proposal.kind;
  const isPending = proposal.status === "pending";
  const accepted = proposal.status === "accepted";
  const rejected = proposal.status === "rejected";

  const handleAccept = async () => {
    await accept.mutateAsync({
      id: proposalId,
      body: Object.keys(picks).length > 0 ? { disambiguation: picks } : undefined,
    });
  };

  const ambiguityFields = (proposal.ambiguity ?? {}) as Record<
    string,
    { candidates?: Array<Record<string, unknown>> }
  >;

  const handleReject = async () => {
    await reject.mutateAsync({ id: proposalId });
  };

  return (
    <Card
      className={
        accepted
          ? "border-success/30 bg-success/5"
          : rejected
            ? "border-destructive/30 bg-destructive/5"
            : "border-primary/20"
      }
    >
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{summary}</CardTitle>
          <Badge variant={accepted ? "default" : rejected ? "destructive" : "secondary"}>
            {KIND_LABELS[proposal.kind] || proposal.kind}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-2 space-y-2">
        {editing ? (
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(proposal.resolved_payload || proposal.payload, null, 2)}
          </pre>
        ) : (
          <div className="text-xs text-muted-foreground">
            {Object.entries(proposal.resolved_payload || proposal.payload)
              .filter(([k]) => k !== "summary_es")
              .slice(0, 4)
              .map(([k, v]) => (
                <div key={k}>
                  <span className="font-medium">{fieldLabel(k)}:</span>{" "}
                  <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))}
          </div>
        )}

        {Object.entries(ambiguityFields).map(([field, info]) => {
          const cands = info.candidates;
          if (!cands || cands.length < 2) return null;
          return (
            <ProposalDisambiguationPicker
              key={field}
              field={field}
              candidates={cands as never}
              selected={picks[field]}
              onPick={(id) => setPicks((p) => ({ ...p, [field]: id }))}
            />
          );
        })}

        {isPending && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAccept} disabled={accept.isPending} className="gap-1">
              {accept.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              Aceptar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing((e) => !e)}
              className="gap-1"
            >
              <Pencil className="size-3" />
              {editing ? "Ocultar" : "Ver detalle"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReject}
              disabled={reject.isPending}
              className="gap-1 text-destructive"
            >
              <X className="size-3" />
              Rechazar
            </Button>
          </div>
        )}
        {accepted && (
          <p className="text-xs text-success pt-1">
            ✓ Aceptado{proposal.created_row_id ? ` → ${proposal.created_row_id.slice(0, 8)}` : ""}
          </p>
        )}
        {rejected && <p className="text-xs text-destructive pt-1">✗ Rechazado</p>}
      </CardContent>
    </Card>
  );
}
