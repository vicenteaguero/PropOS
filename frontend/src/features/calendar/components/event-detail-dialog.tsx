import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EntityLinkRow, ErrorState, Pill } from "@shared/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { label } from "@shared/lib/labels";
import { NAV_APP_LABEL, navHref } from "@shared/lib/nav-app";
import { MapsMark, WazeMark } from "@shared/ui/icons/brand-marks";
import { DealSheet } from "@features/deals/components/deal-sheet";
import { TYPE_META, durationLabel, kindLabel, timeLabel } from "../lib/calendar-item";
import type { CalendarItem, EventDetail } from "../api/calendar-api";

interface EventDetailDialogProps {
  item: CalendarItem | null;
  full: EventDetail | null | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  role: string;
}

/**
 * One event, as a card you can act on.
 *
 * A centred dialog on every size, not a bottom sheet. A sheet you drag up from
 * the bottom is the right shape for a task you are performing; this is a thing
 * you are inspecting, and dragging it around cost a gesture on the way in and
 * gave nothing back.
 *
 * The order is the order the questions get asked: what, when, where — then
 * everything it is attached to, which is what was missing entirely. A visit
 * used to be a title, a pill and the word "Programado", with the deal, the
 * property and the people it concerned all one tap away and no tap offered.
 */
export function EventDetailDialog({
  item,
  full,
  loading,
  error,
  onRetry,
  onOpenChange,
  onEdit,
  onDelete,
  role,
}: EventDetailDialogProps) {
  const navigate = useNavigate();
  const [dealOpen, setDealOpen] = useState(false);
  if (!item) return null;

  const meta = TYPE_META[item.item_type];
  const isEvent = item.item_type === "EVENT";
  const address = full?.location ?? item.location ?? null;
  const dealId = full?.opportunity_id ?? item.opportunity_id ?? null;
  const waze = navHref(address, "waze");
  const maps = navHref(address, "maps");
  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <>
      <Dialog open={!!item} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="max-w-md gap-0 p-0">
          <div className="flex items-start gap-3 px-5 pt-5">
            <span
              aria-hidden
              className="mt-1.5 h-9 w-[3px] shrink-0 rounded-full"
              style={{ background: meta.dot }}
            />
            <DialogTitle className="min-w-0 flex-1 text-[20px] font-bold leading-tight tracking-tight">
              {item.title ?? "Sin título"}
            </DialogTitle>
            <Button
              size="icon"
              variant="ghost"
              className="-mr-1 -mt-1 size-9 shrink-0 rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar"
            >
              <X className="size-4" strokeWidth={2} />
            </Button>
          </div>

          <div className="space-y-4 px-5 pb-5 pt-4">
            {/* When — the line people actually came for. */}
            <div>
              <p className="text-[15px] font-semibold text-foreground first-letter:uppercase">
                {item.start_at
                  ? format(new Date(item.start_at), "EEEE d 'de' MMMM", { locale: es })
                  : "Sin fecha"}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {item.all_day ? "Todo el día" : `${timeLabel(item)} · ${durationLabel(item)}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone={meta.tone}>{isEvent ? kindLabel(item.kind) : meta.label}</Pill>
              {item.status && (
                <Pill tone="neutral">
                  {label(item.item_type === "TASK" ? "taskStatus" : "eventStatus", item.status)}
                </Pill>
              )}
            </div>

            {loading && <Skeleton className="h-10 w-full rounded-xl" />}
            {!!error && <ErrorState error={error} onRetry={onRetry} compact />}

            {address && (
              <div className="space-y-2">
                <p className="text-[13.5px] text-muted-foreground">{address}</p>
                {(waze || maps) && (
                  <div className="flex gap-2">
                    {waze && (
                      <a
                        href={waze}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-secondary text-[13.5px] font-semibold"
                      >
                        <WazeMark size={16} /> {NAV_APP_LABEL.waze}
                      </a>
                    )}
                    {maps && (
                      <a
                        href={maps}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-secondary text-[13.5px] font-semibold"
                      >
                        <MapsMark size={16} /> {NAV_APP_LABEL.maps}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Everything it hangs off. The deal leads because it contains the
                rest of the answer. */}
            {(dealId || item.property_id || item.contact_id) && (
              <div className="space-y-1.5">
                {dealId && <EntityLinkRow kind="DEAL" onClick={() => setDealOpen(true)} />}
                {item.property_id && (
                  <EntityLinkRow
                    kind="PROPERTY"
                    onClick={() => go(`/${role}/propiedades/${item.property_id}`)}
                  />
                )}
                {item.contact_id && (
                  <EntityLinkRow
                    kind="CONTACT"
                    onClick={() => go(`/${role}/personas/${item.contact_id}`)}
                  />
                )}
              </div>
            )}

            {isEvent && (
              // Small, and to the side. Editing and deleting are not what this
              // card is for, and two `flex-1` buttons made them look like it.
              <div className="flex justify-end gap-1 border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={onEdit}
                  disabled={loading || !!error}
                >
                  <Pencil className="size-4" strokeWidth={1.8} /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="size-4" strokeWidth={1.8} /> Eliminar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DealSheet dealId={dealId} role={role} open={dealOpen} onOpenChange={setDealOpen} />
    </>
  );
}
