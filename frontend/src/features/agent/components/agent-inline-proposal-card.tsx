import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { useAcceptProposal, useRejectProposal } from "@features/pending/hooks/use-pending";
import { useQuery } from "@tanstack/react-query";
import { pendingApi } from "@features/pending/api/pending-api";
import { ProposalDisambiguationPicker } from "@features/pending/components/proposal-disambiguation-picker";
import { ProposalEvidenceQuote } from "@features/pending/components/proposal-evidence";
import { RejectProposalSheet } from "@features/pending/components/reject-proposal-sheet";
import type { RejectBody } from "@features/pending/api/pending-api";
import { agentActionLabel, label } from "@shared/lib/labels";

interface Props {
  proposalId: string;
}

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
  const [rejecting, setRejecting] = useState(false);
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

  const kindLabel = agentActionLabel(proposal.kind);
  const summary = (proposal.payload?.summary_es as string) || kindLabel;
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

  const handleReject = async (body: RejectBody) => {
    await reject.mutateAsync({ id: proposalId, body });
    setRejecting(false);
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
            {kindLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-2 space-y-2">
        <ProposalEvidenceQuote evidence={proposal.evidence} />

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
              onClick={() => setRejecting(true)}
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
        {rejected && (
          <p className="text-xs text-destructive pt-1">
            ✗ Rechazado
            {proposal.review_reason ? ` — ${label("rejectReason", proposal.review_reason)}` : ""}
          </p>
        )}
      </CardContent>

      <RejectProposalSheet
        open={rejecting}
        onOpenChange={setRejecting}
        summary={summary}
        submitting={reject.isPending}
        onConfirm={handleReject}
      />
    </Card>
  );
}
