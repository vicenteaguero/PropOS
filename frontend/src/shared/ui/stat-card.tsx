import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A single headline number with its label.
 *
 * Both analytics pages declared this privately — byte-identical apart from one
 * page supporting a `destructive` tone the other lacked, so the same metric
 * could render red on one screen and neutral on the next.
 */
export function StatCard({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  /** `ink` inverts the card for the primary metric; `destructive` reddens the value. */
  tone?: "ink" | "destructive";
  className?: string;
}) {
  const isInk = tone === "ink";
  return (
    <div
      className={cn(
        "rounded-xl p-4",
        isInk ? "bg-foreground text-background" : "bg-secondary text-foreground",
        className,
      )}
    >
      <p
        className={cn(
          "text-[13px] font-medium",
          isInk ? "text-background/70" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tracking-tight tabular-nums",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Titled container for one chart. */
export function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <h2 className="mb-3 text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
      {children}
    </div>
  );
}
