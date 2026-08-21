import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { SearchInput } from "@shared/components/search-input/search-input";
import { ErrorState } from "./error-state";
import { PageSkeleton, type PageSkeletonVariant } from "./page-skeleton";

interface ListShellSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name. Falls back to the placeholder. */
  ariaLabel?: string;
}

interface ListShellProps {
  /**
   * Names the list. Omit inside a tabbed section — the tab already names the
   * view, and printing both put "Personas" directly under a tab reading
   * "Personas" on every list in the app. The accessible heading survives
   * either way (see `titleSr`).
   */
  title?: string;
  /** Heading for assistive tech when `title` is deliberately not painted. */
  titleSr?: string;
  /** Search field, on the title line. Omit for surfaces with nothing to search. */
  search?: ListShellSearch;
  /** Primary action, on the title line, hard right. */
  action?: ReactNode;
  /** Filter row under the header: chips, a pill TabBar, a date range. */
  filters?: ReactNode;
  /** Small trailing text on the title line — a result count, a sync time. */
  meta?: ReactNode;

  /** State machine, evaluated in this order: loading → error → empty → body. */
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyAction?: { label: string; onClick: () => void };
  /** Replaces the default EmptyState entirely. */
  empty?: ReactNode;
  errorMessage?: string;
  /** Shape of the loading placeholder; match the real body. */
  skeleton?: PageSkeletonVariant;

  /**
   * Pin the header and filters and scroll only the body. Required inside a
   * MasterDetail pane, where the pane — not the page — owns the scroll.
   */
  fill?: boolean;
  /**
   * Body gutter. `page` pads the body to --page-x; `none` lets rows bleed to
   * the edge (a Row already carries the gutter itself).
   */
  bodyPadding?: "page" | "none";
  /** Under the body: cap notices, "load more", totals. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * The list page, once.
 *
 * Every list in the CRM had rebuilt the same four parts by hand — a header, a
 * search box, a filter row, and the loading/error/empty triad — in a different
 * order with a different inset each time, so moving between two tabs of the
 * SAME section changed the gutter and the max width. Worse, the search was
 * always a sibling block below the title rather than beside the action, which
 * on a wide monitor left ~1500px between the field and the button that acts on
 * what you searched for.
 *
 * Here the title, the search and the primary action share one line, the filters
 * get the next, and the states are the shell's business rather than each
 * page's. A page supplies data and rows.
 */
export function ListShell({
  title,
  titleSr,
  search,
  action,
  filters,
  meta,
  isLoading = false,
  error,
  onRetry,
  isEmpty = false,
  emptyTitle = "Sin resultados",
  emptyAction,
  empty,
  errorMessage,
  skeleton = "list",
  fill = false,
  bodyPadding = "none",
  footer,
  children,
  className,
}: ListShellProps) {
  const header = (
    <div className={cn("shrink-0 px-[var(--page-x)] pt-4", filters ? "pb-3" : "pb-4")}>
      <div className="flex flex-wrap items-center gap-3">
        <h2
          className={cn(
            "shrink-0 text-[17px] font-semibold leading-tight tracking-tight text-foreground",
            !title && "sr-only",
          )}
        >
          {title ?? titleSr}
        </h2>
        {meta && <span className="shrink-0 text-[13px] text-muted-foreground">{meta}</span>}
        {search && (
          // Grows into the free space but caps out, so on a 2560px monitor the
          // field ends where the action begins instead of a screen away.
          <SearchInput
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder ?? "Buscar..."}
            ariaLabel={search.ariaLabel ?? search.placeholder}
            variant="inline"
            debounceMs={0}
            // Shares the row with the action at every width. It used to take
            // `basis-full` below sm, which wrapped the primary action onto a
            // line of its own — one whole row of a phone screen holding a
            // single 36px round button.
            //
            // `ml-auto` only when a title is actually painted: it exists to push
            // the field away from the heading, and with the heading `sr-only`
            // (see `titleSr`) it instead pinned the search to the right edge of
            // a 1440px board, across an empty half-screen from nothing.
            className={cn(
              "order-first min-w-0 flex-1 sm:order-none sm:max-w-sm",
              title && "sm:ml-auto",
            )}
          />
        )}
        {action && <div className={cn("flex shrink-0 gap-2", !search && "ml-auto")}>{action}</div>}
      </div>
      {filters && <div className="mt-3">{filters}</div>}
    </div>
  );

  const body = (
    <>
      {isLoading && <PageSkeleton variant={skeleton} className="px-[var(--page-x)] py-2" />}
      {!isLoading && error != null && error !== false && (
        <div className="px-[var(--page-x)] py-2">
          <ErrorState message={errorMessage} error={error} onRetry={onRetry} />
        </div>
      )}
      {!isLoading && !error && isEmpty && (
        <div className="px-[var(--page-x)] py-4">
          {empty ?? (
            <EmptyState
              title={emptyTitle}
              actionLabel={emptyAction?.label}
              onAction={emptyAction?.onClick}
            />
          )}
        </div>
      )}
      {!isLoading && !error && !isEmpty && children}
      {footer}
    </>
  );

  if (!fill) {
    return (
      <div className={cn("pb-8", className)}>
        {header}
        <div className={bodyPadding === "page" ? "px-[var(--page-x)]" : undefined}>{body}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      {header}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto pb-6",
          bodyPadding === "page" && "px-[var(--page-x)]",
        )}
      >
        {body}
      </div>
    </div>
  );
}
