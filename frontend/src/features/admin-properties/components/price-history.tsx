import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SectionLabel, Pill } from "@shared/ui";
import { formatClp } from "@shared/utils/currency";
import { formatDate } from "@shared/utils/format";
import { label } from "@shared/lib/labels";
import { propertiesApi, type PriceHistoryEntry } from "../api/properties-api";

/** How much the price moved, as a signed percentage of where it started. */
function movePct(entry: PriceHistoryEntry): number | null {
  const from = entry.price_from_cents;
  const to = entry.price_to_cents;
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

/**
 * Price and status changes, newest first.
 *
 * The trigger behind `property_snapshots` has been recording these since 2024
 * and nothing ever read them, so "¿hace cuánto está en este precio?" — the
 * question that decides whether to push a buyer — had its answer sitting in the
 * database with no way to see it. Renders nothing when a listing has never
 * moved, which is the honest answer rather than an invented starting point.
 */
export function PriceHistory({ propertyId }: { propertyId: string }) {
  const { data: history } = useQuery({
    queryKey: ["property", propertyId, "history"],
    queryFn: () => propertiesApi.history(propertyId),
  });

  // A row where nothing moved is noise: it reads as "reduced by 0,0%". The
  // trigger cannot produce one, but a backfill or a rounding pass over the
  // stored values can, and a history that lists non-events is not trustworthy.
  const changes = (history ?? []).filter((e) =>
    e.trigger === "price_change"
      ? e.price_from_cents !== e.price_to_cents
      : e.status_from !== e.status_to,
  );

  if (changes.length === 0) return null;

  return (
    <div>
      <SectionLabel>Historial</SectionLabel>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {changes.map((entry, i) => {
          const pct = movePct(entry);
          const dropped = pct != null && pct < 0;
          const Arrow = dropped ? ArrowDown : ArrowUp;
          return (
            <li
              key={`${entry.at}-${i}`}
              className="flex items-center gap-3 bg-card px-4 py-3 text-[13px]"
            >
              <span className="w-24 shrink-0 text-muted-foreground">{formatDate(entry.at)}</span>
              {entry.trigger === "price_change" ? (
                <>
                  <span className="min-w-0 flex-1 truncate tabular-nums text-muted-foreground line-through">
                    {formatClp(entry.price_from_cents, "—")}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-foreground">
                    {formatClp(entry.price_to_cents, "—")}
                  </span>
                  {pct != null && (
                    <Pill tone={dropped ? "success" : "warning"}>
                      <Arrow className="size-3" strokeWidth={2.2} />
                      {Math.abs(pct).toFixed(1)}%
                    </Pill>
                  )}
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {label("propertyStatus", entry.status_from ?? "")}
                  </span>
                  <Pill tone="neutral">{label("propertyStatus", entry.status_to ?? "")}</Pill>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
