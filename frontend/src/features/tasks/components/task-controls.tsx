import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { ChoiceSwitch, CONTROL_H, FilterSelect, FOCUS_RING } from "@shared/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@shared/hooks/use-auth";
import { TASK_ORDERS, TASK_PRIORITY_FILTERS } from "../lib/task-order";
import type { TaskOrder, TaskPriorityFilter } from "../lib/task-order";
import { PERIOD_META, type Period, type TaskScope } from "../lib/task-periods";

interface TaskControlsProps {
  scope: TaskScope;
  onScope: (s: TaskScope) => void;
  period: Period;
  onPeriod: (p: Period) => void;
  periodCount: (p: Period) => number;
  priority: TaskPriorityFilter;
  onPriority: (p: TaskPriorityFilter) => void;
  order: TaskOrder;
  onOrder: (o: TaskOrder) => void;
  className?: string;
}

/**
 * One control band, identical on the phone and on the laptop.
 *
 * There used to be two control rows on a phone plus a third row for the period
 * title, and a different, wordier set on desktop — so the screen with the most
 * room carried the least usable version.
 *
 * This is one filter row plus a full-width period segmented, and it replaces
 * all three: the segmented names the period, so the big "Hoy" heading that sat
 * under it was saying the same word twice. Net effect on a phone is one row
 * less and the first task ~44px higher.
 *
 * Why the segmented gets its own line rather than joining the filter row: five
 * periods, a scope switch and two buttons come to well over the 328px a 360px
 * phone has. Prioridad and Ordenar are the two that are idle most of the time,
 * so they give up their words — the sheet they open still carries the label.
 *
 * The scope switch says the workspace's own name rather than "Todo el equipo",
 * because in a two-person brokerage "el equipo" is a stranger and the name on
 * the door is not.
 */
export function TaskControls({
  scope,
  onScope,
  period,
  onPeriod,
  periodCount,
  priority,
  onPriority,
  order,
  onOrder,
  className,
}: TaskControlsProps) {
  const { user, memberships } = useAuth();
  // The workspace's own name. `user` carries only its id, so the label comes
  // from the membership row that matches it — the same place the workspace
  // switcher reads it from.
  const teamLabel = memberships.find((m) => m.tenantId === user?.tenantId)?.tenantName ?? "Equipo";
  const periods = PERIOD_META.filter((p) => p.id !== "nodate" || periodCount("nodate") > 0);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <ChoiceSwitch
          label="Tareas de"
          value={scope}
          options={[
            { value: "mine", label: "Mías" },
            { value: "team", label: teamLabel },
          ]}
          onChange={(v) => onScope(v as TaskScope)}
          className="shrink-0"
        />

        <span className="min-w-0 flex-1" />

        <FilterSelect
          label="Prioridad"
          iconOnly
          icon={<SlidersHorizontal className="size-4" strokeWidth={1.9} />}
          value={priority === "all" ? null : priority}
          allLabel="Todas"
          options={TASK_PRIORITY_FILTERS.filter((f) => f.value !== "all").map((f) => ({
            value: f.value,
            label: f.label,
          }))}
          onChange={(v) => onPriority((v as TaskPriorityFilter) ?? "all")}
          className="shrink-0"
        />
        <FilterSelect
          label="Ordenar"
          iconOnly
          icon={<ArrowUpDown className="size-4" strokeWidth={1.9} />}
          value={order}
          options={TASK_ORDERS.map((o) => ({ value: o.value, label: o.label, sub: o.sub }))}
          onChange={(v) => onOrder((v as TaskOrder) ?? "due")}
          className="shrink-0"
        />
      </div>

      {/* Segmented, matching the calendar's Día/Semana/Mes — same job, same
          shape, same height. Equal columns, so it cannot overflow. */}
      <div
        role="group"
        aria-label="Cuándo"
        className={cn(
          CONTROL_H,
          "flex w-full items-center gap-0.5 rounded-full bg-secondary p-0.5",
        )}
      >
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPeriod(p.id)}
            aria-pressed={period === p.id}
            className={cn(
              "h-full min-w-0 flex-1 rounded-full px-1 text-[12px] font-semibold transition",
              FOCUS_RING,
              period === p.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <span className="block truncate">{p.label}</span>
            {periodCount(p.id) > 0 && <span className="sr-only">, {periodCount(p.id)} tareas</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
