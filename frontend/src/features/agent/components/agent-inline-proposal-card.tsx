import { useState } from "react";
import { formatDate, formatDateTime } from "@shared/utils/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { useAcceptProposal, useRejectProposal } from "@features/pending/hooks/use-pending";
import { useQuery } from "@tanstack/react-query";
import { pendingApi } from "@features/pending/api/pending-api";
import { ProposalDisambiguationPicker } from "@features/pending/components/proposal-disambiguation-picker";
import { ProposalEvidenceQuote } from "@features/pending/components/proposal-evidence";
import { RejectProposalSheet } from "@features/pending/components/reject-proposal-sheet";
import type { RejectBody } from "@features/pending/api/pending-api";
import { agentActionLabel, label, type LabelKind } from "@shared/lib/labels";
import type { PendingProposal } from "@features/agent/types";

interface Props {
  proposalId: string;
  /**
   * The proposal itself, when the caller already has it.
   *
   * The Pendientes page fetches the whole list and then rendered one card per
   * row by id — and every card fetched itself again. Six proposals meant seven
   * round trips to display data that arrived complete in the first one, on a
   * backend where the per-request cost dominates. The chat still passes only an
   * id, because there a proposal arrives as a reference inside a message.
   */
  proposal?: PendingProposal;
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

export function AgentInlineProposalCard({ proposalId, proposal: given }: Props) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const accept = useAcceptProposal();
  const reject = useRejectProposal();

  const { data: fetched, isLoading } = useQuery({
    queryKey: ["pending", "detail", proposalId],
    queryFn: () => pendingApi.get(proposalId),
    refetchInterval: false,
    enabled: given === undefined,
  });
  const proposal = given ?? fetched;

  if (isLoading || !proposal) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3.5 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando propuesta…
      </div>
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

  /**
   * Every field, for the drawer. The four-line preview above is the summary;
   * "Ver detalle" used to answer it with `JSON.stringify(payload, null, 2)` in a
   * monospace block — the raw wire shape, English keys and all, on a surface
   * whose entire premise is that the broker can judge the proposal without
   * leaving the queue.
   */
  const allFields = Object.entries(proposal.resolved_payload || proposal.payload).filter(([k, v]) =>
    isShownToHumans(k, v),
  );
  const previewFields = allFields
    .filter(([, v]) => !echoesTheQuote(v, proposal.evidence?.quote as string | undefined))
    .slice(0, 3);

  return (
    /* A plain surface, not shadcn's <Card>. That component ships `gap-6` between
       header and content and `py-6`/`px-6` around them — 24px of air in three
       places on a card whose whole content is a title, a quote and three short
       lines, so four proposals filled a phone screen and the queue could not be
       scanned. Same tokens, a third of the padding. */
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        accepted
          ? "border-success/30 bg-success/5"
          : rejected
            ? "border-destructive/30 bg-destructive/5"
            : "border-border bg-card",
      )}
    >
      <div className="flex items-baseline gap-2">
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
          {summary}
        </h3>
        {(accepted || rejected) && (
          <span
            className={cn(
              "shrink-0 text-[11.5px] font-semibold",
              accepted ? "text-success" : "text-destructive",
            )}
          >
            {accepted ? "Aceptada" : "Rechazada"}
          </span>
        )}
      </div>

      <ProposalEvidenceQuote evidence={proposal.evidence} className="mt-2" />

      {previewFields.length > 0 && (
        <dl className="mt-2 space-y-0.5 text-[12.5px] leading-snug">
          {previewFields.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="shrink-0 text-muted-foreground">{fieldLabel(k)}</dt>
              <dd className="min-w-0 flex-1 truncate text-foreground">{fieldValue(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {editing && (
        <dl className="mt-2 space-y-0.5 border-t border-border pt-2 text-[12.5px] leading-snug">
          {allFields.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="shrink-0 text-muted-foreground">{fieldLabel(k)}</dt>
              <dd className="min-w-0 flex-1 text-foreground">{fieldValue(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {Object.entries(ambiguityFields).map(([field, info]) => {
        const cands = info.candidates;
        if (!cands || cands.length < 2) return null;
        return (
          <div key={field} className="mt-2">
            <ProposalDisambiguationPicker
              field={field}
              candidates={cands as never}
              selected={picks[field]}
              onPick={(id) => setPicks((p) => ({ ...p, [field]: id }))}
            />
          </div>
        );
      })}

      {isPending && (
        /* Accept is the answer 90% of the time and gets the only filled button;
           reject is a bare glyph on the far side of the row, where a thumb
           reaching for "Aceptar" cannot land on it. */
        <div className="mt-2.5 flex items-center gap-2">
          <Button size="sm" onClick={handleAccept} disabled={accept.isPending} className="gap-1.5">
            {accept.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" strokeWidth={2.4} />
            )}
            Aceptar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing((e) => !e)}
            className="gap-1 text-muted-foreground"
          >
            <Pencil className="size-3.5" />
            {editing ? "Ocultar" : "Detalle"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Rechazar"
            onClick={() => setRejecting(true)}
            disabled={reject.isPending}
            className="ml-auto text-muted-foreground hover:text-destructive"
          >
            <X className="size-4" strokeWidth={2.2} />
          </Button>
        </div>
      )}
      {rejected && proposal.review_reason && (
        <p className="mt-2 text-[12px] text-destructive">
          {label("rejectReason", proposal.review_reason)}
        </p>
      )}

      <RejectProposalSheet
        open={rejecting}
        onOpenChange={setRejecting}
        summary={summary}
        submitting={reject.isPending}
        onConfirm={handleReject}
      />
    </div>
  );
}
