import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "accent" | "success" | "warning" | "destructive";

const TONE: Record<PillTone, string> = {
  neutral: "bg-secondary text-foreground",
  accent: "bg-accent-brand/12 text-accent-brand",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  /** optional leading status dot */
  dot?: string;
  children: ReactNode;
}

/** Soft rounded status/label chip. Tone drives color; pass `dot` for a leading dot. */
export function Pill({ tone = "neutral", dot, className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        // shrink-0 + nowrap: a pill is a fixed token, so it must never set the
        // minimum width of the row it sits in nor wrap mid-label.
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight whitespace-nowrap",
        TONE[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  );
}
