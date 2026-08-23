import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MasterDetailProps {
  list: ReactNode;
  detail: ReactNode;
  /** optional context rail, shown only at 2xl when present */
  aside?: ReactNode;
  /** is a detail item selected — on mobile this swaps list → detail */
  selected: boolean;
  listWidth?: string;
  asideWidth?: string;
  className?: string;
}

/**
 * Responsive master-detail. Phone (<md): single column — list, or detail when
 * something is selected (push navigation). Tablet and up (md): list | detail
 * grid. 2xl: optional third context rail.
 *
 * The md threshold is the CSS half of `useIsDesktop`; they must stay in step or
 * a caller flips its state while the grid is still single-column, stranding the
 * user on a detail pane with no list and no back affordance.
 */
export function MasterDetail({
  list,
  detail,
  aside,
  selected,
  listWidth = "22rem",
  asideWidth = "20rem",
  className,
}: MasterDetailProps) {
  return (
    <div
      style={{ "--list-w": listWidth, "--aside-w": asideWidth } as CSSProperties}
      className={cn(
        // Full height minus the header and the tab strip — but NOT the bottom
        // nav. Subtracting the nav here made the list end exactly where the bar
        // begins, so nothing ever passed underneath it and its backdrop blur
        // had nothing to blur: the bar read as a solid white band. The list
        // column pads itself instead (below), so rows scroll under the bar and
        // the last one still clears it.
        "h-[calc(100dvh-var(--app-header-h,3.5rem)-var(--section-tabs-h,0px))] w-full overflow-hidden",
        "md:grid md:[grid-template-columns:var(--list-w)_minmax(0,1fr)]",
        aside && "2xl:[grid-template-columns:var(--list-w)_minmax(0,1fr)_var(--aside-w)]",
        className,
      )}
    >
      <div
        className={cn(
          // `pb`, not a shorter box: the rows go under the bar, the last one
          // does not.
          "h-full min-w-0 overflow-y-auto pb-[var(--app-nav-h,0px)] md:border-r md:border-border md:pb-0",
          selected ? "hidden md:block" : "block",
        )}
      >
        {list}
      </div>
      {/* The detail pane keeps the old maths: what sits at its bottom edge is a
          composer, and a text field half-hidden behind a translucent bar is not
          a design choice. */}
      <div
        className={cn(
          "min-w-0 overflow-y-auto",
          "h-[calc(100%-var(--app-nav-h,0px))] md:h-full",
          selected ? "block" : "hidden md:block",
        )}
      >
        {detail}
      </div>
      {aside && (
        <div className="hidden h-full min-w-0 overflow-y-auto border-l border-border 2xl:block">
          {aside}
        </div>
      )}
    </div>
  );
}
