import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PageSkeletonVariant = "list" | "cards" | "detail" | "table";

interface PageSkeletonProps {
  /** Shape preset. Pick the one that matches the real content so the swap is not jarring. */
  variant?: PageSkeletonVariant;
  /** Placeholder items: rows for `list`/`table`, cards for `cards`. Ignored by `detail`. */
  count?: number;
  /** Columns per row, `table` only. */
  columns?: number;
  className?: string;
}

const DEFAULT_COUNT: Record<PageSkeletonVariant, number> = {
  list: 6,
  cards: 12,
  detail: 1,
  table: 8,
};

/** Rows echoing the `Row` primitive: leading square + title/sub, separated by dividers. */
function ListSkeleton({ count }: { count: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-14 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Poster-ratio tiles + caption lines. Mirrors the documents grid. */
function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[3/4] w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Header (title + sub + actions) followed by stacked content blocks. */
function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-7 w-2/3 max-w-sm" />
        <Skeleton className="h-4 w-1/3 max-w-[12rem]" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

/** Header row + body rows of evenly split cells. */
function TableSkeleton({ count, columns }: { count: number; columns: number }) {
  const cells = Array.from({ length: columns });
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-3">
        {cells.map((_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: count }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3">
            {cells.map((_, c) => (
              <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-[40%]")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shape-accurate loading placeholder. Prefer this over spinners so the layout
 * does not jump when data lands.
 */
export function PageSkeleton({
  variant = "list",
  count,
  columns = 4,
  className,
}: PageSkeletonProps) {
  const items = count ?? DEFAULT_COUNT[variant];
  return (
    <div className={className} aria-busy="true" aria-live="polite">
      {variant === "list" && <ListSkeleton count={items} />}
      {variant === "cards" && <CardsSkeleton count={items} />}
      {variant === "detail" && <DetailSkeleton />}
      {variant === "table" && <TableSkeleton count={items} columns={columns} />}
    </div>
  );
}
