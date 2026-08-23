import { Briefcase, CalendarDays, ListChecks } from "lucide-react";
import { EmailMark, Row, WhatsAppMark } from "@shared/ui";
import { listTime } from "@shared/utils/relative-time";
import { shortName, shortPropertyTitle } from "@shared/utils/display-name";
import { cn } from "@/lib/utils";
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
 * Both placements are correct — urgency here tracks the DEADLINE (WhatsApp's
 * 24h free-form window, a portal enquiry every other broker also received), not
 * age — but the words claimed otherwise.
 *
 * "Urgente" is a priority, not a clock, so nothing under it can contradict it.
 * And to answer the question this naming keeps provoking: none of this is AI.
 * `backend/app/features/attention/service.py` is five deterministic rules over
 * timestamps, plus whatever a human has flagged for the next 48 h.
 */
export const URGENCY_LABEL: Record<Urgency, string> = {
  now: "Urgente",
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
  const unread = item.unread ?? 0;
  return (
    <Row
      divider={divider}
      onClick={() => onOpen(item)}
      // Half the vertical padding, which is the whole change: at `py-3` a
      // 390px phone showed 7 rows, and the app this is measured against shows
      // 7.5 with the list at ~75% of the screen. The rows lost no content —
      // the property line moved under the message instead of beside it.
      className={cn("py-1.5", selected && "bg-secondary/60")}
      left={<KindMark item={item} />}
      title={
        <span className={cn("truncate", unread > 0 && "font-bold")}>
          {shortName(item.title, item.title)}
        </span>
      }
      titleRight={
        <span className="flex items-center gap-1.5">
          {/* `--info`, never `--primary`: primary is the tenant's brand hue and
              changes per workspace, so unread would be a different colour in
              every one — the same mistake the calendar made with event types. */}
          {unread > 0 && (
            <span
              aria-label={`${unread} sin leer`}
              className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--color-info)] px-1 text-[10.5px] font-bold text-[var(--color-info-foreground)]"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span className="text-[12px] font-medium text-faint">
            {listTime(item.last_at ?? item.at)}
          </span>
        </span>
      }
      sub={
        <span className="block min-w-0">
          {/* The message. The list carried names and timestamps and not one
              character of anything anyone had said, so two rows from the same
              person were indistinguishable without opening both. */}
          {item.preview && (
            <span className="line-clamp-2 text-[13px] text-muted-foreground">{item.preview}</span>
          )}
          <span className="flex min-w-0 items-baseline gap-1.5">
            {item.subtitle ? (
              // The property, in the brand accent: it is the one thing on the
              // row that identifies WHAT this is about, and grey buried it.
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--color-accent-brand)]">
                {shortPropertyTitle(item.subtitle)}
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[12px] text-faint">
                Sin propiedad vinculada
              </span>
            )}
            {/* Never truncates. The deadline is the whole point of the row, and
                a "Vencida hace…" that stops before the number says nothing. */}
            <span className={`shrink-0 text-[12px] font-medium ${URGENCY_TEXT[item.urgency]}`}>
              {item.reason}
            </span>
          </span>
        </span>
      }
    />
  );
}
