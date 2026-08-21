import { Briefcase, CalendarDays, ListChecks } from "lucide-react";
import { EmailMark, Row, WhatsAppMark } from "@shared/ui";
import { listTime } from "@shared/utils/relative-time";
import type { AttentionItem, AttentionKind, Urgency } from "../api/attention-api";

/** Urgency drives colour, and colour here means "how soon does this expire". */
const URGENCY_TEXT: Record<Urgency, string> = {
  now: "text-destructive",
  today: "text-warning",
  soon: "text-muted-foreground",
};

/**
 * Section headings — a RANK, not a clock.
 *
 * These read "Ahora · Hoy · Cuando puedas", which sounds like elapsed time and
 * therefore contradicted the row beneath it on sight: a portal lead from 19
 * hours ago sat under "Ahora" while a thread from six days ago sat under "Hoy".
 * Both placements are correct — urgency here tracks the deadline (WhatsApp's
 * 24h free-form window, a portal enquiry every other broker also received), not
 * age — but the words claimed otherwise. Ordinal words cannot contradict a
 * timestamp.
 */
export const URGENCY_LABEL: Record<Urgency, string> = {
  now: "Primero",
  today: "Después",
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

/**
 * The channel or record the item came from.
 *
 * In brand colour, not as a grey outline. A broker triaging an inbox is sorting
 * by channel before anything else — what you can say, and how fast, is decided
 * by whether this is WhatsApp inside its window or an e-mail — and the green
 * tile answers that in peripheral vision, where a monochrome bubble does not.
 */
function KindMark({ item }: { item: AttentionItem }) {
  if (item.conversation_id) return <WhatsAppMark size={22} />;
  if (item.thread_id) return <EmailMark size={22} />;
  if (item.event_id)
    return <CalendarDays className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.7} />;
  if (item.task_id)
    return <ListChecks className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.7} />;
  return <Briefcase className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.7} />;
}

/**
 * One thing waiting on the broker.
 *
 * Two lines, four facts, in the order they are read: who, when, what it is
 * about, and how soon it stops being fixable. The subtitle is the property —
 * "Depto 2D Ñuñoa" is recognised instantly and a phone number never is — and the
 * deadline trails it on the same line in the urgency colour, so a narrow pane
 * truncates the context before it truncates the deadline.
 *
 * The timestamp on the title line is what every messaging app puts there and
 * what this row was missing: without it "Sin responder hace 19 h" was the only
 * temporal signal, and it had to be read word by word instead of scanned.
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
      titleRight={
        <span className="text-[12px] font-medium text-faint">{listTime(item.at)}</span>
      }
      sub={
        <span className="flex min-w-0 items-baseline gap-1.5">
          {item.subtitle ? (
            <span className="min-w-0 flex-1 truncate">{item.subtitle}</span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-faint">Sin propiedad vinculada</span>
          )}
          {/* Never truncates. The deadline is the whole point of the row, and a
              "Vencida hace…" that stops before the number says nothing. */}
          <span className={`shrink-0 font-medium ${URGENCY_TEXT[item.urgency]}`}>
            {item.reason}
          </span>
        </span>
      }
    />
  );
}
