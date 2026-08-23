import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  useTopbarActionsSlot,
  useTopbarOwnsSearch,
  useTopbarSlotOccupied,
} from "@layouts/topbar-slot";
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
  /**
   * Secondary actions, on the search line — a door to a sibling catalogue, a
   * view switch. The PRIMARY action goes to `primaryAction`.
   */
  action?: ReactNode;
  /**
   * The one action this surface exists to start: new conversation, new deal,
   * new person. On a phone it is portalled into the top bar, where it takes the
   * place of the command-palette magnifier (see useTopbarOwnsSearch) — the most
   * reachable corner of the screen, and the one that used to hold a second
   * search affordance directly above this one's field.
   *
   * In the sidebar shell there is no such bar, so it renders here beside the
   * secondary actions, exactly as before.
   */
  primaryAction?: ReactNode;
  /** Filter row under the header: chips, a pill TabBar, a date range. */
  filters?: ReactNode;
  /**
   * Put `filters` on the header row instead of under it.
   *
   * For a control that is not really a filter — a view switch — where a row of
   * its own costs 56px of a phone screen to hold three buttons.
   */
  filtersInline?: boolean;
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
  primaryAction,
  filters,
  filtersInline = false,
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
  // Only when this surface actually renders a field — a list with no search
  // must not steal the magnifier from the bar.
  useTopbarOwnsSearch(!!search);
  const actionsHost = useTopbarActionsSlot();
  const tabsInBar = useTopbarSlotOccupied();
  const inBar = !!primaryAction && !!actionsHost;

  const header = (
    // `pt-2` when the section's tabs are in the bar: the bar closes with its own
    // `py-2`, so the old `pt-4` stacked two paddings and left a gap between the
    // tabs and the search wide enough to read as a mistake.
    <div
      className={cn(
        "shrink-0 px-[var(--page-x)]",
        tabsInBar ? "pt-2" : "pt-4",
        filters ? "pb-3" : "pb-4",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          className={cn(
            "shrink-0 text-[17px] font-semibold leading-tight tracking-tight text-foreground",
            !title && "sr-only",
          )}
        >
          {title ?? titleSr}
        </h2>
        {meta && (
          // Shrinkable, and on a phone it drops to its own line. `shrink-0` on a
          // sentence like "3 de 12 se pueden enviar fuera de las 24 h" ate the
          // whole row and squeezed the search field down to its magnifier.
          <span className="order-last min-w-0 basis-full truncate text-[13px] text-muted-foreground sm:order-none sm:basis-auto">
            {meta}
          </span>
        )}
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
        {/* Inline: a view switch is not a filter row, it is a control that
            belongs beside the field it changes the results of. Propiedades put
            it on a line of its own, which cost a whole row of a phone screen
            to hold three 40px buttons. */}
        {filters && filtersInline && (
          <div className="order-last shrink-0 sm:order-none">{filters}</div>
        )}
        {(action || (primaryAction && !inBar)) && (
          <div className={cn("flex shrink-0 items-center gap-2", !search && "ml-auto")}>
            {action}
            {/* Only when there is no bar to portal it into — otherwise it would
                appear twice on the same screen. */}
            {!inBar && primaryAction}
          </div>
        )}
      </div>
      {filters && !filtersInline && <div className="mt-3">{filters}</div>}
    </div>
  );

  const portalledAction = inBar ? createPortal(primaryAction, actionsHost) : null;

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
      <div className={cn("pb-[calc(var(--app-nav-h,0px)+2rem)]", className)}>
        {portalledAction}
        {header}
        <div className={bodyPadding === "page" ? "px-[var(--page-x)]" : undefined}>{body}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
      {portalledAction}
      {header}
      <div
        className={cn(
          // The bottom clearance for the floating nav lands HERE, on the
          // scroller, so it follows the last row instead of shortening the
          // viewport box that holds it.
          "min-h-0 flex-1 overflow-y-auto pb-[calc(var(--app-nav-h,0px)+1.5rem)]",
          bodyPadding === "page" && "px-[var(--page-x)]",
        )}
      >
        {body}
      </div>
    </div>
  );
}
