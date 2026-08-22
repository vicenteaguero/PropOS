import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";

interface WipStateProps {
  /** What the finished feature will be called. */
  title: string;
  /**
   * What it will let someone do, in plain language.
   *
   * Written for the broker, not for us: no "portales", no "integración", no
   * feature names. A screen that says only "en construcción" tells the person
   * looking at it nothing about whether they should wait for it or find
   * another way to do their job today.
   */
  description: string;
  className?: string;
}

/**
 * A surface that is deliberately unfinished, said out loud.
 *
 * Distinct from `EmptyState`, which means "this works, there is nothing in it
 * yet" — the opposite message, and the two were being confused: a half-built
 * screen full of dead buttons reads as a broken feature rather than an
 * unfinished one, and people report it as a bug.
 *
 * Deliberately has no action slot. If there were something useful to press,
 * this would not be the right component.
 */
export function WipState({ title, description, className }: WipStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-secondary">
        <Hammer className="size-6 text-muted-foreground" strokeWidth={1.7} />
      </span>
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
        En construcción
      </p>
      <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
