import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PageSkeletonVariant =
  | "list"
  | "cards"
  | "detail"
  | "table"
  | "chart"
  | "kpi-grid"
  | "board"
  | "masonry";

interface PageSkeletonProps {
  /** Shape preset. Pick the one that matches the real content so the swap is not jarring. */
  variant?: PageSkeletonVariant;
  /**
   * Placeholder items: rows for `list`/`table`, cards for `cards`/`masonry`,
   * tiles for `kpi-grid`, columns for `board`. Ignored by `detail`/`chart`.
   */
  count?: number;
  /** Columns per row: cells for `table`, tiles per wide row for `kpi-grid`. */
  columns?: number;
  className?: string;
}

const DEFAULT_COUNT: Record<PageSkeletonVariant, number> = {
  list: 6,
  cards: 12,
  detail: 1,
  table: 8,
  chart: 1,
  "kpi-grid": 4,
  board: 4,
  masonry: 8,
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

// Column bars, tallest in the middle, so the placeholder reads as a plot and not
// as a stack of cards while Recharts measures its container.
const CHART_BAR_HEIGHTS = ["h-[45%]", "h-[70%]", "h-[55%]", "h-[90%]", "h-[62%]", "h-[78%]"];

/** A single plot: legend, plot body with bars sitting on a baseline, axis ticks. */
function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
      <div className="flex h-56 items-end gap-3 border-b border-border pb-px">
        {CHART_BAR_HEIGHTS.map((h, i) => (
          <Skeleton key={i} className={cn("flex-1 rounded-t-md", h)} />
        ))}
      </div>
      <div className="flex gap-3">
        {CHART_BAR_HEIGHTS.map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
    </div>
  );
}

// Tailwind only ships classes it can see in the source, so the wide-column count
// has to come from a literal map rather than an interpolated `lg:grid-cols-${n}`.
const KPI_WIDE_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** KPI tiles two-up on a phone, `columns`-up from `lg`, then the charts below. */
function KpiGridSkeleton({ count, columns }: { count: number; columns: number }) {
  return (
    <div className="space-y-6">
      <div className={cn("grid grid-cols-2 gap-3 lg:gap-4", KPI_WIDE_COLS[columns] ?? "")}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-4">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

// Cards per kanban column; uneven on purpose, a real pipeline never is.
const BOARD_COLUMN_CARDS = [3, 2, 4, 2, 3];

/** Horizontally scrolling kanban: fixed-width columns of stacked cards. */
function BoardSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-3 overflow-x-hidden">
      {Array.from({ length: count }).map((_, c) => (
        <div key={c} className="w-64 shrink-0 space-y-3 rounded-xl bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-5 rounded-full" />
          </div>
          {Array.from({ length: BOARD_COLUMN_CARDS[c % BOARD_COLUMN_CARDS.length] ?? 3 }).map(
            (_, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

// Varied heights: the point of a masonry placeholder is that the columns do not
// end level, which a uniform card grid cannot suggest.
const MASONRY_HEIGHTS = ["h-28", "h-44", "h-36", "h-24", "h-40", "h-32", "h-48", "h-28"];

/** CSS-columns masonry of variable-height cards. Mirrors the notes grid. */
function MasonrySkeleton({ count }: { count: number }) {
  return (
    <div className="columns-2 gap-3 lg:columns-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "mb-3 w-full break-inside-avoid rounded-xl",
            MASONRY_HEIGHTS[i % MASONRY_HEIGHTS.length],
          )}
        />
      ))}
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
      {variant === "chart" && <ChartSkeleton />}
      {variant === "kpi-grid" && <KpiGridSkeleton count={items} columns={columns} />}
      {variant === "board" && <BoardSkeleton count={items} />}
      {variant === "masonry" && <MasonrySkeleton count={items} />}
    </div>
  );
}
