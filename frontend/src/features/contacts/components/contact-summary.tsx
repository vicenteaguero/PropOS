import { Link } from "react-router-dom";
import { Building2, CalendarClock, MessageSquareWarning, Timer } from "lucide-react";
import { Pill } from "@shared/ui";
import { formatClp } from "@shared/utils/currency";
import { label } from "@shared/lib/labels";
import { stageDot, STAGE_LABELS } from "@features/opportunities/types";
import { timeAgoInline, whenLabelInline } from "@shared/utils/relative-time";
import { useContactOverview } from "../hooks/use-contacts";

/** One fact per line, label left, value right. */
function Fact({
  icon,
  children,
  tone,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "alert";
}) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className={tone === "alert" ? "text-destructive" : "text-muted-foreground"}>
        {icon}
      </span>
      <span className={tone === "alert" ? "text-destructive" : "text-foreground"}>{children}</span>
    </div>
  );
}

/**
 * Where this relationship stands, above the tabs.
 *
 * The page led with a phone number and four empty tab labels, so deciding what
 * to do about a person meant opening Interacciones to find the last contact,
 * Oportunidades to find what is open, and the agenda to find out whether a
 * visit was already booked. Those three answers now arrive with the page.
 */
export function ContactSummary({ contactId, role }: { contactId: string; role: string }) {
  const { data } = useContactOverview(contactId);
  if (!data) return null;

  const { next_event: next, deals, counts } = data;
  const nothing = !data.awaiting_reply && !next && deals.length === 0 && !data.last_interaction_at;
  if (nothing) return null;

  return (
    <div className="mx-[var(--page-x)] mb-5 space-y-3 rounded-xl bg-card p-4">
      <div className="space-y-2">
        {data.awaiting_reply && (
          <Fact icon={<MessageSquareWarning className="size-4" strokeWidth={1.8} />} tone="alert">
            Te escribió y sigue sin respuesta
          </Fact>
        )}
        {next && (
          <Fact icon={<CalendarClock className="size-4" strokeWidth={1.8} />}>
            {label("eventKind", next.kind)} {whenLabelInline(next.starts_at)}
            {next.property_title ? ` · ${next.property_title}` : ""}
          </Fact>
        )}
        {data.last_interaction_at && (
          <Fact icon={<Timer className="size-4" strokeWidth={1.8} />}>
            Último contacto {timeAgoInline(data.last_interaction_at)}
            {data.last_interaction_kind
              ? ` · ${label("interactionKind", data.last_interaction_kind)}`
              : ""}
          </Fact>
        )}
      </div>

      {deals.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          {deals.map((deal) => (
            <div key={deal.id} className="flex items-center gap-2">
              <Pill dot={stageDot(deal.pipeline_stage ?? "")}>
                {STAGE_LABELS[deal.pipeline_stage ?? ""] ?? deal.pipeline_stage}
              </Pill>
              {deal.property_id ? (
                <Link
                  to={`/${role}/properties/${deal.property_id}`}
                  className="min-w-0 flex-1 truncate text-[13px] text-foreground hover:underline"
                >
                  {deal.property_title || "Sin propiedad"}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                  Sin propiedad
                </span>
              )}
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-foreground">
                {formatClp(deal.expected_value_cents)}
              </span>
            </div>
          ))}
        </div>
      )}

      {counts.open_tasks > 0 && (
        <div className="flex items-center gap-2 border-t border-border pt-3 text-[13px] text-muted-foreground">
          <Building2 className="size-4" strokeWidth={1.8} />
          {counts.open_tasks} tarea{counts.open_tasks === 1 ? "" : "s"} abierta
          {counts.open_tasks === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
