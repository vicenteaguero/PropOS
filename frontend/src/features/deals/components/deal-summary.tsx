import { useNavigate } from "react-router-dom";
import {
  Banknote,
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  ListTodo,
  StickyNote,
  User,
} from "lucide-react";
import { ErrorState, Pill, SectionLabel } from "@shared/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGE_LABELS } from "@features/opportunities/types";
import { formatClp } from "@shared/utils/currency";
import { formatDateTime } from "@shared/utils/format";
import { useDealOverview } from "../hooks/use-deal";

interface DealSummaryProps {
  dealId: string;
  role: string;
  /** Rendered above the content — the sheet uses it for a "ver ficha" link. */
  footer?: React.ReactNode;
  onNavigate?: () => void;
}

/**
 * Everything about one deal, small enough to drop anywhere.
 *
 * This exists because "which negocio is this?" is the question asked from a
 * calendar event, a document, a note and a task — four places that previously
 * either said nothing about the deal or bounced the user out to a page and lost
 * their context. One component, one query, four call sites.
 */
export function DealSummary({ dealId, role, footer, onNavigate }: DealSummaryProps) {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useDealOverview(dealId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => refetch()} compact />;
  if (!data) return null;

  const { opportunity: deal, participants, properties, next_event: next, counts } = data;
  const go = (path: string) => {
    onNavigate?.();
    navigate(path);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="accent">{STAGE_LABELS[deal.pipeline_stage] ?? deal.pipeline_stage}</Pill>
        {deal.status && deal.status !== "OPEN" && <Pill tone="neutral">{deal.status}</Pill>}
        {deal.expected_value_cents ? (
          <span className="text-[15px] font-bold tabular-nums text-foreground">
            {formatClp(deal.expected_value_cents)}
          </span>
        ) : null}
      </div>

      {next && (
        <button
          type="button"
          onClick={() => go(`/${role}/agenda?tab=calendario`)}
          className="flex w-full items-center gap-3 rounded-xl bg-secondary px-3 py-2.5 text-left"
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-foreground">
              {next.title ?? "Evento"}
            </span>
            {next.starts_at && (
              <span className="block text-[12.5px] text-muted-foreground">
                {formatDateTime(next.starts_at)}
              </span>
            )}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        </button>
      )}

      {properties.length > 0 && (
        <section>
          <SectionLabel>Propiedades</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {properties.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => go(`/${role}/propiedades/${p.id}`)}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 text-left transition active:scale-[0.99]"
                >
                  <Building2 className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                    {p.title ?? p.address ?? "Propiedad"}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {participants.length > 0 && (
        <section>
          <SectionLabel>Personas</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {participants.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => go(`/${role}/personas/${p.id}`)}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 text-left transition active:scale-[0.99]"
                >
                  <User className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                    {p.full_name ?? "Sin nombre"}
                  </span>
                  {p.role && <Pill tone="neutral">{p.role}</Pill>}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Counts rather than lists: this is a summary, and four more scrollable
          sections would make it the page it is meant to save you from. */}
      <div className="grid grid-cols-2 gap-2">
        <CountTile icon={ListTodo} label="Tareas abiertas" value={counts.open_tasks} />
        <CountTile icon={FileText} label="Documentos" value={counts.documents} />
        <CountTile icon={StickyNote} label="Notas" value={counts.notes} />
        <CountTile
          icon={Banknote}
          label="Movimientos"
          value={counts.transactions}
          sub={
            data.pending_amount_cents
              ? `${formatClp(data.pending_amount_cents)} pendiente`
              : undefined
          }
        />
      </div>

      {footer}
    </div>
  );
}

function CountTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof ListTodo;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" strokeWidth={1.9} />
        <span className="truncate text-[11.5px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-0.5 text-[18px] font-bold tabular-nums text-foreground">{value}</div>
      {sub && <div className="truncate text-[11.5px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
