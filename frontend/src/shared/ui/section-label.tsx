import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_ROW_COARSE } from "./touch-target";

interface SectionLabelProps {
  children: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
  className?: string;
}

/**
 * Section heading with an optional trailing text action.
 *
 * Carries NO horizontal padding: the page container owns the gutter (--page-x).
 * Baking `px-5` in here forced every sibling on a page to repeat the same
 * number by hand, which is how the home screen's paddings drifted apart.
 */
export function SectionLabel({ children, action, onAction, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{children}</h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            "shrink-0 text-sm font-semibold text-primary hover:underline",
            TOUCH_TARGET_ROW_COARSE,
          )}
        >
          {action}
        </button>
      )}
    </div>
  );
}
