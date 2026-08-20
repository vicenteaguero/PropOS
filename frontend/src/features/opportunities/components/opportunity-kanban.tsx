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
import { Pill, TOUCH_TARGET_HIT_AREA } from "@shared/ui";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, STAGE_LABELS, type Opportunity } from "../types";
import { initials } from "@shared/utils/format";

interface Props {
  opportunities: Opportunity[];
  nameFor: (personId: string | null) => string;
  onMove: (id: string, stage: string) => void;
  onWon: (opp: Opportunity) => void;
  onLost: (opp: Opportunity) => void;
  onEdit: (opp: Opportunity) => void;
}

// Per-stage accent dot. Semantic tokens only (resolved to CSS vars at runtime).
const STAGE_DOT: Record<string, string> = {
  LEAD: "var(--muted-foreground)",
  QUALIFIED: "var(--accent-brand)",
  VISIT: "var(--primary)",
  OFFER: "var(--warning)",
  RESERVATION: "var(--warning)",
  CLOSED: "var(--success)",
};

function formatClp(cents: number | null): string {
  if (!cents) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function Card({
  opp,
  nameFor,
  onWon,
  onLost,
  onEdit,
}: { opp: Opportunity } & Omit<Props, "opportunities" | "onMove">) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;
  const name = nameFor(opp.person_id);
  const value = formatClp(opp.expected_value_cents);
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-border bg-card p-3 transition-shadow ${
        isDragging ? "opacity-50 shadow-lg" : "shadow-sm"
      }`}
    >
      <div {...listeners} {...attributes} className="cursor-grab touch-none">
        <button onClick={() => onEdit(opp)} className="flex w-full items-center gap-2.5 text-left">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
            {initials(name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight text-foreground">
              {name}
            </span>
            {value && (
              <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
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
      <div className="mt-2.5 flex gap-1.5">
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
    <div className="flex w-72 shrink-0 flex-col lg:h-full lg:w-auto lg:min-w-0 lg:flex-1">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: STAGE_DOT[stage] ?? "var(--muted-foreground)" }}
          />
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
