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
    "flex w-full items-center gap-3 px-5 py-3 text-left",
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
