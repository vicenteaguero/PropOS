import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspacePillProps {
  label: string;
  /** dot color; defaults to the active tenant accent */
  color?: string;
  onClick?: () => void;
  className?: string;
}

/** Workspace/tenant selector trigger, styled as a pill tinted by the active accent. */
export function WorkspacePill({ label, color, onClick, className }: WorkspacePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line-strong bg-background py-1.5 pr-3 pl-2.5 transition active:scale-95",
        className,
      )}
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
}
