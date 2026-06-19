import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-height desktop surface: on lg+ it pins to the viewport below the app
 * header and scrolls internally (kanban, time-grids). On mobile it's a normal
 * flow column. Single source for the `100dvh - header` calc.
 */
export function AppShellScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col lg:h-[calc(100dvh-var(--app-header-h,3.5rem))] lg:overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
