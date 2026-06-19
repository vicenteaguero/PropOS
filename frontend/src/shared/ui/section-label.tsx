import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
  className?: string;
}

/** Section heading with an optional trailing text action. */
export function SectionLabel({ children, action, onAction, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 px-5", className)}>
      <h2 className="text-xl font-bold tracking-tight text-foreground">{children}</h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-semibold text-primary hover:underline"
        >
          {action}
        </button>
      )}
    </div>
  );
}
