import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspacePillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  /** dot color; defaults to the active tenant accent */
  color?: string;
}

/**
 * Workspace/tenant selector trigger, styled as a pill tinted by the active
 * accent. Forwards ref + props so it can act as a Radix `asChild` trigger.
 */
export const WorkspacePill = forwardRef<HTMLButtonElement, WorkspacePillProps>(
  function WorkspacePill({ label, color, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-line-strong bg-background py-1.5 pr-3 pl-2.5 transition active:scale-95",
          className,
        )}
        {...props}
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: color ?? "var(--accent-brand)" }}
        />
        <span className="max-w-[10rem] truncate text-[13.5px] font-bold tracking-tight text-foreground">
          {label}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.25} />
      </button>
    );
  },
);
