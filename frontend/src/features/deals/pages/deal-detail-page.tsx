import { Link, useNavigate, useParams } from "react-router-dom";
import { useShellMode } from "@shared/hooks/use-shell-mode";
import { usePageTitle } from "@app/page-meta";
import { ArrowLeft, Building2, CheckCircle2, Circle, CircleDashed, User } from "lucide-react";
import { PageLayout } from "@shared/components/page-layout";
import { ErrorState, PageSkeleton, Pill, Row, RoundButton, SectionLabel } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import { formatClp } from "@shared/utils/currency";
import { label } from "@shared/lib/labels";
import { stageDot, STAGE_LABELS } from "@features/opportunities/types";
import { dayLabel, dueText, timeAgoInline, whenLabel } from "@shared/utils/relative-time";
import { shortName } from "@shared/utils/display-name";
import { Button } from "@/components/ui/button";
import { useDeal, useSetDealStage } from "../hooks/use-deal";
import type { ChecklistItem } from "../api/deals-api";

const ITEM_ICON = {
  done: CheckCircle2,
  in_progress: CircleDashed,
  pending: Circle,
  blocked: Circle,
  na: Circle,
} as const;

const ITEM_TONE: Record<ChecklistItem["status"], string> = {
  done: "text-success",
  in_progress: "text-warning",
  pending: "text-muted-foreground",
  blocked: "text-destructive",
  na: "text-faint",
};

/**
 * A deal, and after the handshake, its file.
 *
 * There was no page for this at all — a kanban card was the whole surface, so
 * participants, the properties it touches and its history had nowhere to live.
 *
 * The two halves are the same entity seen at two moments. Before the agreement
 * the uncertainty is WHETHER it happens and the broker controls most of it, so
 * the page leads with the pipeline. After, the uncertainty is WHEN, and what
 * blocks it is the bank, the notaría and the conservador — none of which move
 * because somebody followed up. So the page leads with the paperwork.
 */
export function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const shellOwnsBack = useShellMode() === "bottom-nav";
  const { user } = useAuth();
  const role = (user?.role ?? "ADMIN").toLowerCase();
  const { data, isLoading, error, refetch } = useDeal(id);
  const setStage = useSetDealStage(id ?? "");
  // Names the browser tab and the phone shell's top bar, which was blank here:
  // `/negocios/:id` is not a nav path, so there was nothing to fall back to.
  usePageTitle(data?.participants[0]?.full_name);

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error || !data) {
    return <ErrorState message="No se pudo cargar el negocio." onRetry={() => refetch()} />;
  }

  const { opportunity: deal, participants, properties, history, checklist } = data;
  const stage = deal.pipeline_stage ?? "";
  const hasFile = checklist.length > 0;
  const blocking = checklist.filter((i) => i.blocking && i.status !== "done");

  return (
    <PageLayout width="md" noPadding className="pb-6">
      {/* Back is hidden in the phone shell, whose top bar carries one on every
          route below a section root. See useShellMode. */}
      <div className="flex items-center justify-between px-[var(--page-x)] pt-4 pb-2">
        {shellOwnsBack ? (
          <span />
        ) : (
          <RoundButton
            tone="ghost"
            aria-label="Volver"
            onClick={() => navigate(`/${role}/clientes?tab=negocios`)}
          >
            <ArrowLeft className="size-5" strokeWidth={1.8} />
          </RoundButton>
        )}
        <Pill dot={stageDot(stage)}>{STAGE_LABELS[stage] ?? stage}</Pill>
      </div>

      <div className="px-[var(--page-x)] pb-4">
        <h1 className="text-[21px] font-semibold leading-tight tracking-tight text-foreground">
          {shortName(participants[0]?.full_name, "Negocio sin participantes")}
        </h1>
        <p className="mt-1 font-mono text-[17px] tabular-nums text-foreground">
          {formatClp(deal.expected_value_cents)}
        </p>

        {/* The four facts the model has always carried and the page has never
            shown. A deal page that cannot tell you when it is expected to
            close, or why it was lost, is a list of sections about a deal
            rather than the deal. */}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {deal.expected_close_at && (
            <Fact label="Cierre estimado" value={dayLabel(new Date(deal.expected_close_at))} />
          )}
          {typeof deal.probability === "number" && (
            <Fact label="Probabilidad" value={`${deal.probability}%`} />
          )}
          <Fact label="Creado" value={whenLabel(deal.created_at)} />
          {deal.lost_reason && (
            <Fact label="Motivo de pérdida" value={deal.lost_reason} tone="bad" />
          )}
        </dl>

        {deal.notes && (
          <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted-foreground">
            {deal.notes}
          </p>
        )}
      </div>

      {/* The moves that are legal from here. The server declares them, so the
          page cannot offer one it is about to refuse.

          Captioned, because four bare outline buttons reading "Oferta",
          "Cerrado", "Perdido" beside a pill that ALSO names a stage read as a
          filter or as the deal's current state — not as "press this and the
          deal moves". */}
      {data.allowed_transitions.length > 0 && (
        <div className="mb-5 px-[var(--page-x)]">
          <SectionLabel>Mover a</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.allowed_transitions.map((t) => (
              <Button
                key={t.to_stage}
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={setStage.isPending}
                onClick={() => setStage.mutate(t.to_stage)}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: stageDot(t.to_stage) }}
                />
                {/* `requires_human` deliberately shows nothing here. It governs
                  PROPO, not the broker — and this screen is the broker's, so a
                  padlock on the one move only they can make read as "you are
                  not allowed", the exact opposite of what the flag means. The
                  distinction is surfaced where it is actionable: Configuración
                  → Clientes → Pipelines. */}
                {STAGE_LABELS[t.to_stage] ?? t.to_stage}
              </Button>
            ))}
          </div>
        </div>
      )}

      {hasFile && (
        <section className="mb-5">
          <div className="px-[var(--page-x)]">
            <SectionLabel>
              Expediente
              {blocking.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-destructive">
                  {blocking.length} bloquean el cierre
                </span>
              )}
            </SectionLabel>
          </div>
          <div className="mt-2">
            {checklist.map((item, i) => {
              const Icon = ITEM_ICON[item.status];
              return (
                <Row
                  key={item.id}
                  divider={i < checklist.length - 1}
                  left={
                    <Icon className={`size-[18px] ${ITEM_TONE[item.status]}`} strokeWidth={1.9} />
                  }
                  title={item.title}
                  sub={
                    <span className="flex items-baseline gap-1.5">
                      {item.blocking && item.status !== "done" && (
                        <span className="shrink-0 font-medium text-destructive">Bloqueante</span>
                      )}
                      {/* A finished item's deadline is not information. */}
                      {item.due_at && item.status !== "done" && (
                        <span className="truncate">{dueText(item.due_at)}</span>
                      )}
                    </span>
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-5">
        <div className="px-[var(--page-x)]">
          <SectionLabel>Participantes</SectionLabel>
        </div>
        <div className="mt-2">
          {participants.length === 0 ? (
            <p className="px-[var(--page-x)] text-[13px] text-muted-foreground">
              Nadie vinculado todavía.
            </p>
          ) : (
            participants.map((p, i) => (
              <Row
                key={p.id}
                divider={i < participants.length - 1}
                left={<User className="size-[18px] text-muted-foreground" strokeWidth={1.8} />}
                title={p.full_name || "Sin nombre"}
                sub={label("participantRole", p.role)}
                onClick={() => navigate(`/${role}/personas/${p.contact_id}`)}
              />
            ))
          )}
        </div>
      </section>

      <section className="mb-5">
        <div className="px-[var(--page-x)]">
          <SectionLabel>Propiedades</SectionLabel>
        </div>
        <div className="mt-2">
          {properties.length === 0 ? (
            <p className="px-[var(--page-x)] text-[13px] text-muted-foreground">
              Ninguna propiedad vinculada.
            </p>
          ) : (
            properties.map((p, i) => (
              <Row
                key={p.id}
                divider={i < properties.length - 1}
                left={<Building2 className="size-[18px] text-muted-foreground" strokeWidth={1.8} />}
                title={p.property?.title ?? "Propiedad eliminada"}
                sub={label("dealPropertyRole", p.role)}
                right={
                  p.property?.list_price_cents ? (
                    <span className="shrink-0 font-mono text-[13px] tabular-nums text-foreground">
                      {formatClp(p.property.list_price_cents)}
                    </span>
                  ) : undefined
                }
                onClick={() => navigate(`/${role}/propiedades/${p.property_id}`)}
              />
            ))
          )}
        </div>
      </section>

      {history.length > 0 && (
        <section className="mb-5">
          <div className="px-[var(--page-x)]">
            <SectionLabel>Historial</SectionLabel>
          </div>
          <div className="mt-2">
            {history.map((h, i) => (
              <Row
                key={`${h.changed_at}-${i}`}
                divider={i < history.length - 1}
                title={
                  h.from_stage
                    ? `${STAGE_LABELS[h.from_stage] ?? h.from_stage} → ${STAGE_LABELS[h.to_stage] ?? h.to_stage}`
                    : (STAGE_LABELS[h.to_stage] ?? h.to_stage)
                }
                sub={timeAgoInline(h.changed_at)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="px-[var(--page-x)] pb-8">
        <Link
          to={`/${role}/timeline/opportunities/${deal.id}`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Ver línea de tiempo
        </Link>
      </div>
    </PageLayout>
  );
}

export default DealDetailPage;

/** One label/value pair in the deal's header block. */
function Fact({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</dt>
      <dd
        className={
          tone === "bad"
            ? "truncate text-[13.5px] font-medium text-destructive"
            : "truncate text-[13.5px] font-medium text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
