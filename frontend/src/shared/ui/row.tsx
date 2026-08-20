import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RowProps {
  left?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  divider?: boolean;
  className?: string;
}

/** Standard list row: leading slot + title/sub + trailing slot. Tappable when onClick set. */
export function Row({ left, title, sub, right, onClick, divider = true, className }: RowProps) {
  const interactive = !!onClick;
  const content = (
    <>
      {left}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold leading-tight text-foreground">
          {title}
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
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}
