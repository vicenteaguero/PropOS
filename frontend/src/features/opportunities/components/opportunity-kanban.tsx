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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PIPELINE_STAGES, STAGE_LABELS, type Opportunity } from "../types";

interface Props {
  opportunities: Opportunity[];
  nameFor: (personId: string | null) => string;
  onMove: (id: string, stage: string) => void;
  onWon: (opp: Opportunity) => void;
  onLost: (opp: Opportunity) => void;
  onEdit: (opp: Opportunity) => void;
}

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
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border bg-card p-2.5 text-sm shadow-sm ${isDragging ? "opacity-50" : ""}`}
    >
      <div {...listeners} {...attributes} className="cursor-grab touch-none">
        <button onClick={() => onEdit(opp)} className="block w-full text-left font-medium">
          {nameFor(opp.person_id)}
        </button>
        {opp.expected_value_cents != null && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatClp(opp.expected_value_cents)}
          </div>
        )}
        {opp.notes && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{opp.notes}</p>
        )}
      </div>
      <div className="mt-2 flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-1.5 text-[11px] text-emerald-500"
          onClick={() => onWon(opp)}
        >
          <Check className="size-3" /> Ganada
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-1.5 text-[11px] text-destructive"
          onClick={() => onLost(opp)}
        >
          <X className="size-3" /> Perdida
        </Button>
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
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-medium">{STAGE_LABELS[stage] ?? stage}</span>
        <Badge variant="outline" className="text-[10px]">
          {opps.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors ${
          isOver ? "border-primary bg-primary/5" : "border-border"
        }`}
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
      <div className="flex gap-3 overflow-x-auto pb-4">
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
