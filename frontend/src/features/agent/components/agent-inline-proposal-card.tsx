import { useState } from "react";
import { formatDate, formatDateTime } from "@shared/utils/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Loader2, Pencil, Trash2 } from "lucide-react";
import { useAcceptProposal, useRejectProposal } from "@features/pending/hooks/use-pending";
import { useQuery } from "@tanstack/react-query";
import { pendingApi } from "@features/pending/api/pending-api";
import { ProposalDisambiguationPicker } from "@features/pending/components/proposal-disambiguation-picker";
import { ProposalEvidenceQuote } from "@features/pending/components/proposal-evidence";
import { RejectProposalSheet } from "@features/pending/components/reject-proposal-sheet";
import { RectifyProposalSheet } from "@features/pending/components/rectify-proposal-sheet";
import { proposalHeadline } from "@features/pending/lib/headline";
import { SourceMark } from "@features/pending/components/source-mark";
import { deadlineTone, timeLeft } from "@shared/utils/relative-time";
import type { RejectBody } from "@features/pending/api/pending-api";
import { label, type LabelKind } from "@shared/lib/labels";
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

import { fieldLabel } from "@features/pending/lib/field-labels";

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
  const [rectifying, setRectifying] = useState(false);
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

  const summary = proposalHeadline(proposal);
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

  const tone = isPending ? deadlineTone(proposal.expires_at) : "none";
  const left = timeLeft(proposal.expires_at);
  const source = proposal.evidence?.source as string | undefined;

  return (
    /* A plain surface, not shadcn's <Card>. That component ships `gap-6` between
       header and content and `py-6`/`px-6` around them — 24px of air in three
       places on a card whose whole content is a title, a quote and three short
       lines, so four proposals filled a phone screen and the queue could not be
       scanned. Same tokens, a third of the padding.

       Urgency is on the BORDER, not a fill: the card already carries a quote
       block and a field list, and a tinted background behind those makes the
       text the loser. */
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        accepted
          ? "border-success/30 bg-success/5"
          : rejected
            ? "border-destructive/30 bg-destructive/5"
            : tone === "danger"
              ? "border-destructive/50 bg-card"
              : tone === "warn"
                ? "border-warning/50 bg-card"
                : "border-border bg-card",
      )}
    >
      {/* What is running out, and where it came from. The deadline is the
          reason one card outranks another, so it leads. */}
      {(left || source) && (
        <div className="mb-1.5 flex items-center gap-2">
          {left && (
            <span
              className={cn(
                "text-[12px] font-semibold",
                tone === "danger"
                  ? "text-destructive"
                  : tone === "warn"
                    ? "text-warning"
                    : "text-muted-foreground",
              )}
            >
              {left}
            </span>
          )}
          {source && <SourceMark source={source} className="ml-auto" />}
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-foreground">
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
          {/* The widest target, because "almost right" is the common case and
              until now the only way to fix one field was to reject the whole
              proposal and retype it somewhere else. */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRectifying(true)}
            className="flex-1 gap-1.5"
          >
            <Pencil className="size-3.5" />
            Rectificar
          </Button>
          {/* A bin, alone on the far side. Rejecting is the rare answer and the
              one nobody should be able to give by accident. */}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Rechazar"
            title="Rechazar"
            onClick={() => setRejecting(true)}
            disabled={reject.isPending}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" strokeWidth={2} />
          </Button>
        </div>
      )}
      {rejected && proposal.review_reason && (
        <p className="mt-2 text-[12px] text-destructive">
          {label("rejectReason", proposal.review_reason)}
        </p>
      )}

      <RectifyProposalSheet
        open={rectifying}
        onOpenChange={setRectifying}
        proposal={proposal}
        submitting={accept.isPending}
        error={accept.error instanceof Error ? accept.error.message : null}
        onConfirm={async (overrides) => {
          await accept.mutateAsync({
            id: proposalId,
            body: {
              ...(Object.keys(overrides).length > 0 ? { overrides } : null),
              ...(Object.keys(picks).length > 0 ? { disambiguation: picks } : null),
            },
          });
          setRectifying(false);
        }}
      />

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
