import { useState } from "react";
import { ArrowRight, Check, Flag, MapPin, X } from "lucide-react";
import { BottomSheet, Row, TabBar, type TabBarItem } from "@shared/ui";
import { cn } from "@/lib/utils";
import { initials } from "@shared/utils/format";
import { formatClp } from "@shared/utils/currency";
import { PIPELINE_STAGES, STAGE_LABELS, stageDot, type Opportunity } from "../types";
import { useFlaggedIds } from "@features/attention/hooks/use-attention-flags";

interface Props {
  opportunities: Opportunity[];
  nameFor: (personId: string | null) => string;
  propertyFor: (propertyId: string | null) => string | null;
  /** The deal's comuna, for the optional grouping. Null when unknown. */
  comunaFor: (propertyId: string | null) => string | null;
  onMove: (id: string, stage: string) => void;
  onWon: (opp: Opportunity) => void;
  onLost: (opp: Opportunity) => void;
  onOpen: (opp: Opportunity) => void;
}

/**
 * The pipeline on a phone: one stage at a time, as a list.
 *
 * A kanban is a desktop instrument. It works because six columns fit side by
 * side and a card can be dragged between them; on a 390px screen it became six
 * 288px columns in a horizontal scroller — five of them off-canvas, the visible
 * one taking the full width for a card holding a name, a line and an amount,
 * and drag-to-move competing with the scroll gesture that reaches the other
 * stages. Four deals filled the screen and the board could not be read at all.
 *
 * The board answers two questions: where does each deal stand, and what is in
 * play. So the stage becomes the selector — with its count, and its money on
 * the line under it — and the deals become rows, which is the density a phone
 * affords. Moving a deal is an explicit choice from a sheet rather than a drag,
 * because on a touch screen it always was.
 */
export function OpportunityStageList({
  opportunities,
  nameFor,
  propertyFor,
  comunaFor,
  onMove,
  onWon,
  onLost,
  onOpen,
}: Props) {
  const [stage, setStage] = useState<string>(PIPELINE_STAGES[0]);
  const [moving, setMoving] = useState<Opportunity | null>(null);

  const { contacts: flaggedContacts, properties: flaggedProperties } = useFlaggedIds();
  /** Flagged directly, or through the property the deal is about. */
  const watched = (o: Opportunity) =>
    (o.person_id != null && flaggedContacts.has(o.person_id)) ||
    (o.property_id != null && flaggedProperties.has(o.property_id));

  const byStage = (s: string) => opportunities.filter((o) => o.pipeline_stage === s);
  const shown = byStage(stage);
  const total = shown.reduce((sum, o) => sum + (o.expected_value_cents ?? 0), 0);

  /**
   * Optional second axis: comuna.
   *
   * A stage answers "how far along", which is what the board is for. On a busy
   * day the other question is "what is in Ñuñoa" — a broker plans a morning by
   * neighbourhood, not by pipeline stage. Off by default: it is a second
   * grouping, not a second board.
   */
  const [byComuna, setByComuna] = useState(false);
  const groups: Array<[string, Opportunity[]]> = byComuna
    ? [
        ...shown
          .reduce((map, o) => {
            const key = comunaFor(o.property_id) ?? "Sin comuna";
            map.set(key, [...(map.get(key) ?? []), o]);
            return map;
          }, new Map<string, Opportunity[]>())
          .entries(),
      ].sort(([a], [b]) => a.localeCompare(b, "es"))
    : [["", shown]];

  const tabs: TabBarItem[] = PIPELINE_STAGES.map((s) => ({
    id: s,
    label: STAGE_LABELS[s] ?? s,
    count: byStage(s).length,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TabBar items={tabs} value={stage} onChange={setStage} variant="pill" gutter={false} />

      {/* What is in this stage, in money. The single most-asked question about a
          pipeline, and the board never answered it — the amounts were one per
          card with no total anywhere. */}
      <div className="flex items-baseline gap-2 py-2.5">
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: stageDot(stage) }} />
          {shown.length} {shown.length === 1 ? "negocio" : "negocios"}
        </span>
        {total > 0 && (
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {formatClp(total, "")}
          </span>
        )}
        <button
          type="button"
          onClick={() => setByComuna((v) => !v)}
          aria-pressed={byComuna}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
            byComuna
              ? "border-foreground bg-ink text-ink-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <MapPin className="size-3.5" strokeWidth={2} />
          Comuna
        </button>
      </div>

      <div className="-mx-[var(--page-x)] min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && (
          <p className="px-[var(--page-x)] py-6 text-center text-[14px] text-muted-foreground">
            Nada en {STAGE_LABELS[stage] ?? stage}.
          </p>
        )}
        {groups.map(([comuna, rows]) => (
          <div key={comuna}>
            {byComuna && (
              <div className="flex items-baseline gap-2 border-b border-border bg-secondary/40 px-[var(--page-x)] py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {comuna}
                </span>
                <span className="text-[11px] text-faint">{rows.length}</span>
              </div>
            )}
            {rows.map((opp, i) => {
              const name = nameFor(opp.person_id);
              const property = propertyFor(opp.property_id);
              const value = formatClp(opp.expected_value_cents, "");
              return (
                <div key={opp.id} className="relative">
                  {/* A flagged deal is the one thing here that is not decided by a
                  stage: the broker said "watch this". A left rule rather than a
                  fill, so the row's own text keeps its contrast. */}
                  {watched(opp) && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-destructive"
                    />
                  )}
                  <Row
                    divider={i < rows.length - 1}
                    onClick={() => onOpen(opp)}
                    // Clears the move button's column. Without it the amount ran
                    // under the arrow on any deal over a hundred million.
                    className="pr-[calc(var(--page-x)+2.25rem)]"
                    left={
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[12px] font-semibold text-foreground">
                        {initials(name)}
                      </span>
                    }
                    title={
                      <>
                        {watched(opp) && (
                          <Flag
                            aria-label="En seguimiento"
                            className="mr-1 inline size-3.5 align-[-2px] text-destructive"
                            strokeWidth={2.4}
                          />
                        )}
                        {name}
                        {/* `person_id` is only the PRINCIPAL one. Half the deals in a
                        real book have more, and naming one buyer on a two-buyer
                        deal is not shorthand, it is wrong. */}
                        {opp.extra_participants > 0 && (
                          <span className="ml-1.5 text-[12px] font-medium text-muted-foreground">
                            +{opp.extra_participants}
                          </span>
                        )}
                      </>
                    }
                    titleRight={
                      value ? (
                        <span className="text-[13px] font-semibold tabular-nums text-foreground">
                          {value}
                        </span>
                      ) : undefined
                    }
                    sub={
                      <span className="block truncate">
                        {property ?? <span className="text-faint">Sin propiedad</span>}
                        {opp.extra_properties > 0 && (
                          <span className="ml-1.5 tabular-nums">+{opp.extra_properties}</span>
                        )}
                      </span>
                    }
                  />
                  {/* The one thing a list cannot do that a board could: move it. */}
                  <button
                    type="button"
                    aria-label={`Mover ${name}`}
                    onClick={() => setMoving(opp)}
                    className="absolute right-[calc(var(--page-x)-0.25rem)] top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition active:scale-90 active:bg-secondary"
                  >
                    <ArrowRight className="size-[18px]" strokeWidth={1.9} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <BottomSheet
        open={!!moving}
        onOpenChange={(o) => !o && setMoving(null)}
        title={moving ? nameFor(moving.person_id) : ""}
      >
        <div className="mt-1">
          {PIPELINE_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (moving && moving.pipeline_stage !== s) onMove(moving.id, s);
                setMoving(null);
              }}
              className="flex min-h-12 w-full items-center gap-3 border-b border-border py-2.5 text-left"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: stageDot(s) }}
              />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                {STAGE_LABELS[s] ?? s}
              </span>
              {moving?.pipeline_stage === s && (
                <Check className="size-[18px] shrink-0 text-primary" strokeWidth={2.4} />
              )}
            </button>
          ))}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (moving) onWon(moving);
                setMoving(null);
              }}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-success/15 text-[14px] font-semibold text-success transition active:scale-95"
            >
              <Check className="size-4" strokeWidth={2.2} /> Ganada
            </button>
            <button
              type="button"
              onClick={() => {
                if (moving) onLost(moving);
                setMoving(null);
              }}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-destructive/15 text-[14px] font-semibold text-destructive transition active:scale-95"
            >
              <X className="size-4" strokeWidth={2.2} /> Perdida
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
