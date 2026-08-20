import { Briefcase, CalendarDays, ListChecks, Mail } from "lucide-react";
import { BrandMark, Row } from "@shared/ui";
import type { AttentionItem, AttentionKind, Urgency } from "../api/attention-api";

/** Urgency drives colour, and colour here means "how soon does this expire". */
const URGENCY_TEXT: Record<Urgency, string> = {
  now: "text-destructive",
  today: "text-warning",
  soon: "text-muted-foreground",
};

/** Section headings. The queue groups by these instead of badging every row. */
export const URGENCY_LABEL: Record<Urgency, string> = {
  now: "Ahora",
  today: "Hoy",
  soon: "Cuando puedas",
};

export const URGENCY_ORDER: Urgency[] = ["now", "today", "soon"];

export const KIND_LABEL: Record<AttentionKind, string> = {
  unanswered: "Sin responder",
  lead: "Leads",
  visit: "Agenda",
  task: "Tareas",
  stalled: "Negocios detenidos",
};

/** The channel or record the item came from, as a bare glyph. */
function KindMark({ item }: { item: AttentionItem }) {
  const className = "text-muted-foreground";
  if (item.conversation_id)
    return <BrandMark mono brand="whatsapp" size={20} className={className} />;
  if (item.thread_id) return <Mail className="size-5 text-muted-foreground" strokeWidth={1.7} />;
  if (item.event_id)
    return <CalendarDays className="size-5 text-muted-foreground" strokeWidth={1.7} />;
  if (item.task_id)
    return <ListChecks className="size-5 text-muted-foreground" strokeWidth={1.7} />;
  return <Briefcase className="size-5 text-muted-foreground" strokeWidth={1.7} />;
}

/**
 * One thing waiting on the broker.
 *
 * The sub line is the REASON, not the record type: "Quedan 4 h de ventana" is
 * what decides whether this gets opened now, and the property it is about
 * trails it so a narrow pane truncates the context before the deadline.
 *
 * No badge and no timestamp. The first version carried both, and with nine
 * rows on screen that meant nine identical red "Ahora" pills restating a
 * heading that was already there, beside a clock time ("9:00 a. m.") that
 * contradicted the plain-language delay next to it. The urgency now lives in
 * the section heading and in the colour of the reason.
 */
export function AttentionRow({
  item,
  divider,
  selected,
  onOpen,
}: {
  item: AttentionItem;
  divider: boolean;
  selected?: boolean;
  onOpen: (item: AttentionItem) => void;
}) {
  return (
    <Row
      divider={divider}
      onClick={() => onOpen(item)}
      className={selected ? "bg-secondary/60" : undefined}
      left={<KindMark item={item} />}
      title={item.title}
      sub={
        <span className="flex min-w-0 items-baseline gap-1.5">
          {/* Never truncates. The deadline is the whole point of the row, and
              a "Vencida hace…" that stops before the number says nothing. */}
          <span className={`shrink-0 font-medium ${URGENCY_TEXT[item.urgency]}`}>
            {item.reason}
          </span>
          {item.subtitle && (
            <>
              {/* Context, and the first thing to go: the deadline outranks it.
                  The separator hides with it — a dangling "·" at the end of a
                  phone row reads as text that failed to load. */}
              <span className="hidden shrink-0 text-faint sm:inline">·</span>
              <span className="hidden min-w-0 flex-1 truncate sm:inline">{item.subtitle}</span>
            </>
          )}
        </span>
      }
    />
  );
}
