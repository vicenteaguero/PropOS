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
        // Subtract both shell strips. Exactly one is non-zero: the sidebar shell
        // has a header and no bottom nav, the mobile shell the reverse. Getting
        // this wrong cost 56px of phantom header on mobile AND hid the pane's
        // bottom edge (a chat composer, typically) behind the floating nav.
        "h-[calc(100dvh-var(--app-header-h,3.5rem)-var(--app-nav-h,0px)-var(--section-tabs-h,0px))] w-full overflow-hidden",
        "md:grid md:[grid-template-columns:var(--list-w)_minmax(0,1fr)]",
        aside && "2xl:[grid-template-columns:var(--list-w)_minmax(0,1fr)_var(--aside-w)]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full min-w-0 overflow-y-auto md:border-r md:border-border",
          selected ? "hidden md:block" : "block",
        )}
      >
        {list}
      </div>
      <div className={cn("h-full min-w-0 overflow-y-auto", selected ? "block" : "hidden md:block")}>
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
