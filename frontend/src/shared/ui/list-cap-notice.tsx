import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Server-side caps on the list endpoints, mirrored from
 * the backend list routers. Every list route defaults to a `limit`
 * and silently returns at most that many rows.
 */
export const LIST_CAPS = {
  // contacts and properties are paginated now — see `useContactsInfinite` and
  // the properties list. They are deliberately absent: leaving them here would
  // let a page warn about a cap that no longer exists.
  opportunities: 200,
  interactions: 100,
  notes: 100,
  tasks: 200,
  transactions: 200,
  imports: 50,
  campaigns: 100,
  organizations: 100,
  projects: 100,
  publications: 200,
} as const;

export type CappedResource = keyof typeof LIST_CAPS;

/** True when a result set came back exactly at its cap, so rows may be hidden. */
export function isCapped(resource: CappedResource, count: number | undefined): boolean {
  return count !== undefined && count >= LIST_CAPS[resource];
}

/**
 * Tells the broker that a list stopped at the server's cap.
 *
 * Every list endpoint caps at 50–200 rows, the frontend never sent an `offset`,
 * and no screen said so — a broker with 250 contacts saw 100 and had no way to
 * know the other 150 existed. Silent truncation is a trust problem before it is
 * a UX one: the list looks complete, so the missing rows read as missing data.
 *
 * Render it under any list where `isCapped()` holds.
 */
export function ListCapNotice({
  resource,
  count,
  className,
  hint = "Refina la búsqueda o aplica un filtro para ver el resto.",
}: {
  resource: CappedResource;
  count: number | undefined;
  className?: string;
  hint?: string;
}) {
  if (!isCapped(resource, count)) return null;
  return (
    <div
      role="status"
      className={cn(
        "mx-5 my-3 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[13px] text-foreground",
        className,
      )}
    >
      <AlertTriangle className="mt-px size-4 shrink-0 text-warning" strokeWidth={1.9} />
      <span>
        Mostrando los primeros <strong className="font-semibold">{LIST_CAPS[resource]}</strong>{" "}
        resultados. {hint}
      </span>
    </div>
  );
}
