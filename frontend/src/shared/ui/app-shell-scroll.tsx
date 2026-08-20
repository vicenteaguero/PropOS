import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-height workstation surface: on md+ it pins to the viewport below the app
 * header and scrolls internally (kanban, time-grids). On phones it's a normal
 * flow column. Single source for the `100dvh - shell chrome` calc; md matches
 * `useIsDesktop`.
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
        "flex flex-col md:h-[calc(100dvh-var(--app-header-h,3.5rem)-var(--app-nav-h,0px)-var(--section-tabs-h,0px))] md:overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
