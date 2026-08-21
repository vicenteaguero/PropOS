import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RowProps {
  left?: ReactNode;
  title: ReactNode;
  /**
   * Trailing text ON the title line — a timestamp, a price.
   *
   * Not the same slot as `right`, which is a column beside the whole row. A
   * conversation's time belongs beside the name, the way every messaging app
   * puts it, and putting it in `right` instead pushed the two text lines into a
   * narrower column and left the time floating between them.
   */
  titleRight?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  /**
   * Fired when the user shows intent — hover on a pointer, focus on a keyboard
   * — but before the click. The place to prefetch what the click will open.
   *
   * Deliberately not `onPointerDown`: several lists that use this row are also
   * drag surfaces, and the pointer is already claimed by the drag.
   */
  onIntent?: () => void;
  divider?: boolean;
  className?: string;
}

/** Standard list row: leading slot + title/sub + trailing slot. Tappable when onClick set. */
export function Row({
  left,
  title,
  titleRight,
  sub,
  right,
  onClick,
  onIntent,
  divider = true,
  className,
}: RowProps) {
  const interactive = !!onClick;
  const content = (
    <>
      {left}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2 text-base font-semibold leading-tight text-foreground">
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {titleRight && <span className="shrink-0 whitespace-nowrap">{titleRight}</span>}
        </div>
        {sub && <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </>
  );
  const cls = cn(
    // The gutter is the page's, not the row's. `px-5` was baked in here and
    // could not be overridden, so every container that wanted a different
    // inset (a 22rem master-detail pane, a card) had to fight it with a
    // negative margin. --page-x already widens on md+; className still wins.
    "flex w-full items-center gap-3 px-[var(--page-x)] py-3 text-left",
    divider && "border-b border-border",
    interactive && "transition hover:bg-secondary/50 active:scale-[0.99]",
    className,
  );
  return interactive ? (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onIntent}
      onFocus={onIntent}
      className={cls}
    >
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}
