import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Check, X } from "lucide-react";
import { HOVER_REVEAL, Pill, TOUCH_TARGET_HIT_AREA } from "@shared/ui";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, STAGE_LABELS, stageDot, type Opportunity } from "../types";
import { initials } from "@shared/utils/format";
import { formatClp } from "@shared/utils/currency";
import { useIntentPrefetch } from "@shared/hooks/use-intent-prefetch";
import { dealQueries } from "@features/deals/hooks/use-deal";

interface Props {
  opportunities: Opportunity[];
  nameFor: (personId: string | null) => string;
  /** Title of the property the deal is about — the fact that makes a card
   *  recognisable. Without it every card is a name and an amount. */
  propertyFor: (propertyId: string | null) => string | null;
  onMove: (id: string, stage: string) => void;
  onWon: (opp: Opportunity) => void;
  onLost: (opp: Opportunity) => void;
  onEdit: (opp: Opportunity) => void;
}

function Card({
  opp,
  nameFor,
  propertyFor,
  onWon,
  onLost,
  onEdit,
}: { opp: Opportunity } & Omit<Props, "opportunities" | "onMove">) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id });
  const prefetch = useIntentPrefetch();
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;
  const name = nameFor(opp.person_id);
  const property = propertyFor(opp.property_id);
  // Empty string, not the em dash: a card with no figure should show nothing
  // rather than a placeholder competing with the name for attention.
  const value = formatClp(opp.expected_value_cents, "");
  return (
    <div
      ref={setNodeRef}
      style={style}
      // Hover, not pointerdown: the card is a dnd-kit draggable, so the pointer
      // is already claimed by the drag gesture. Hovering is the only signal
      // here that means "about to open" rather than "about to move".
      onMouseEnter={() => prefetch(dealQueries.detail(opp.id))}
      className={`group rounded-xl border border-border bg-card p-3 transition-shadow ${
        isDragging ? "opacity-50 shadow-lg" : "shadow-sm"
      }`}
    >
      <div {...listeners} {...attributes} className="cursor-grab touch-none">
        <button onClick={() => onEdit(opp)} className="flex w-full items-center gap-2.5 text-left">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
            {initials(name)}
          </span>
          <span className="min-w-0 flex-1">
            {/* `person_id` and `property_id` are only the PRINCIPAL ones. Half
                the deals in a real book have more, and a card naming one buyer
                on a two-buyer deal is not shorthand, it is wrong. The suffix is
                the count BEYOND what is shown. */}
            <span className="flex items-baseline gap-1.5">
              <span className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
                {name}
              </span>
              {opp.extra_participants > 0 && (
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">
                  +{opp.extra_participants}
                </span>
              )}
            </span>
            {property && (
              <span className="mt-0.5 flex items-baseline gap-1.5">
                <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">
                  {property}
                </span>
                {opp.extra_properties > 0 && (
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    +{opp.extra_properties}
                  </span>
                )}
              </span>
            )}
            {value && (
              <span className="mt-0.5 block truncate text-[13px] font-semibold tabular-nums text-foreground">
                {value}
              </span>
            )}
          </span>
        </button>
        {opp.notes && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
            {opp.notes}
          </p>
        )}
      </div>
      {/* Won/lost stay out of the way until the card is engaged. Rendered on
          every card they were 186 buttons of chrome on a full board, and they
          are the two actions a broker takes least often — the usual move is to
          drag the card to the next stage. */}
      <div className={`mt-2.5 flex gap-1.5 ${HOVER_REVEAL}`}>
        <button
          onClick={() => onWon(opp)}
          className={`inline-flex h-7 items-center gap-1 rounded-full bg-success/15 px-2.5 text-[11px] font-semibold text-success transition active:scale-95 ${TOUCH_TARGET_HIT_AREA}`}
        >
          <Check className="size-3" strokeWidth={1.8} /> Ganada
        </button>
        <button
          onClick={() => onLost(opp)}
          className={`inline-flex h-7 items-center gap-1 rounded-full bg-destructive/15 px-2.5 text-[11px] font-semibold text-destructive transition active:scale-95 ${TOUCH_TARGET_HIT_AREA}`}
        >
          <X className="size-3" strokeWidth={1.8} /> Perdida
        </button>
      </div>
    </div>
  );
}

function Column({
  stage,
  opps,
  ...rest
}: { stage: string; opps: Opportunity[] } & Omit<Props, "opportunities" | "onMove">) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    // Mobile: fixed-width column in a horizontal scroller.
    // Desktop: equal-width (flex-1), full-height, list scrolls internally.
    // Fixed column width at every size, with the board scrolling horizontally.
    // Splitting the viewport between six stages left ~200px each, which
    // truncated every name and amount on the card.
    <div className="flex w-72 shrink-0 flex-col lg:h-full">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: stageDot(stage) }} />
          <span className="truncate text-base font-bold tracking-tight text-foreground">
            {STAGE_LABELS[stage] ?? stage}
          </span>
        </div>
        <Pill tone="neutral">{opps.length}</Pill>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2.5 rounded-xl border border-dashed p-2.5 transition-colors lg:min-h-0 lg:overflow-y-auto",
          isOver ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        {opps.map((opp) => (
          <Card key={opp.id} opp={opp} {...rest} />
        ))}
      </div>
    </div>
  );
}

export function OpportunityKanban({ opportunities, onMove, ...rest }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const stage = e.over ? String(e.over.id) : null;
    if (!stage) return;
    const opp = opportunities.find((o) => o.id === id);
    if (opp && opp.pipeline_stage !== stage) onMove(id, stage);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {/* Mobile: horizontal scroller. Desktop: full-height board, columns share width. */}
      <div className="flex gap-3 overflow-x-auto pb-4 lg:h-full lg:gap-4 lg:overflow-x-hidden lg:pb-0">
        {PIPELINE_STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            opps={opportunities.filter((o) => o.pipeline_stage === stage)}
            {...rest}
          />
        ))}
      </div>
    </DndContext>
  );
}
