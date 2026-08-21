import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@shared/utils/format";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { useAcceptProposal, useRejectProposal } from "@features/pending/hooks/use-pending";
import { useQuery } from "@tanstack/react-query";
import { pendingApi } from "@features/pending/api/pending-api";
import { ProposalDisambiguationPicker } from "@features/pending/components/proposal-disambiguation-picker";
import { ProposalEvidenceQuote } from "@features/pending/components/proposal-evidence";
import { RejectProposalSheet } from "@features/pending/components/reject-proposal-sheet";
import type { RejectBody } from "@features/pending/api/pending-api";
import { agentActionLabel, label, type LabelKind } from "@shared/lib/labels";

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
  // Keys the resolver adds after matching, which reached the card raw.
  due: "Vence",
  kind: "Tipo",
  person: "Persona",
  summary: "Resumen",
  property: "Propiedad",
  organization: "Organización",
};
const fieldLabel = (k: string) => FIELD_LABELS_ES[k] ?? k;

/**
 * Whether a payload entry means anything to the person reading the card.
 *
 * Resolved payloads carry the foreign keys the executor needs — `contact_id`,
 * `property_id` — and a bare uuid tells a broker nothing while pushing the
 * fields that DO mean something off the four-row preview. The resolved NAME is
 * already on the card; the id is plumbing.
 */
function isShownToHumans(key: string, value: unknown): boolean {
  if (key === "summary_es") return false;
  if (key.endsWith("_id") || key === "id") return false;
  return value !== null && value !== undefined && value !== "";
}

/**
 * The quote is already on the card; repeating it as a field is noise.
 *
 * Several intents copy the client's sentence straight into a payload field —
 * `summary` on an interaction, `body` on a note — so the same words appeared
 * twice, six lines apart, in two different treatments.
 */
function echoesTheQuote(value: unknown, quote: string | undefined): boolean {
  if (!quote || typeof value !== "string") return false;
  const normalise = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  return normalise(quote).includes(normalise(value));
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
/** A due date has no time. It fell through the datetime test and was printed
 *  raw, so one proposal read "Vence: 2026-08-22" and the next, with a time,
 *  read "Inicio: 23-08-2026, 7:00 a. m." — two formats on the same card. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Payload keys whose VALUE is an enum with a Spanish label registry entry. */
const VALUE_LABEL_KIND: Record<string, LabelKind> = {
  kind: "interactionKind",
  channel: "channel",
  type: "contactType",
  status: "taskStatus",
  stage: "pipelineStage",
  listing_kind: "listingKind",
};

/** Payload values are raw wire data: ISO stamps and nested objects. */
function fieldValue(key: string, value: unknown): string {
  if (typeof value === "string" && ISO_DATETIME.test(value)) {
    return formatDateTime(value);
  }
  if (typeof value === "string" && ISO_DAY.test(value)) {
    return formatDate(value);
  }
  // Enum-shaped values are as raw as the keys were: "whatsapp", "OPEN".
  if (typeof value === "string" && VALUE_LABEL_KIND[key]) {
    return label(VALUE_LABEL_KIND[key], value);
  }
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

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
        {/* One name for the action, not two. The title and the badge were
            printing the same string side by side; the badge now carries the
            outcome, which is the thing the title cannot say. */}
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{summary}</CardTitle>
          {(accepted || rejected) && (
            <Badge variant={accepted ? "default" : "destructive"}>
              {accepted ? "Aceptada" : "Rechazada"}
            </Badge>
          )}
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
              .filter(
                ([k, v]) =>
                  isShownToHumans(k, v) &&
                  !echoesTheQuote(v, proposal.evidence?.quote as string | undefined),
              )
              .slice(0, 4)
              .map(([k, v]) => (
                <div key={k}>
                  <span className="font-medium">{fieldLabel(k)}:</span>{" "}
                  <span>{fieldValue(k, v)}</span>
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
