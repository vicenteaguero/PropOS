import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// "app" = full-bleed desktop app surface (no centered column); the rest stay
// centered/capped for forms, auth, and reading.
export type PageWidth = "sm" | "md" | "lg" | "xl" | "full" | "app";

interface PageLayoutProps {
  children: ReactNode;
  width?: PageWidth;
  noPadding?: boolean;
  centered?: boolean;
  className?: string;
}

const widthMap: Record<PageWidth, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
  app: "max-w-none",
};

export function PageLayout({
  children,
  width = "lg",
  noPadding = false,
  centered = false,
  className,
}: PageLayoutProps) {
  if (centered) {
    return (
      <div
        className={cn(
          "flex min-h-[calc(100dvh-var(--app-header-h,0px)-var(--app-nav-h,0px)-var(--section-tabs-h,0px))] w-full items-center justify-center",
          !noPadding && "px-[var(--page-x)] py-6 md:py-8",
          className,
        )}
      >
        <div className={cn("w-full", widthMap[width])}>{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto w-full",
        widthMap[width],
        // `--page-x`, not a repeated `px-4`: the token is the page gutter and
        // it already steps to 1.5rem at md, so the hand-written md: override
        // was a second source of truth that had drifted (`px-6` vs 1.5rem is
        // the same number, which is exactly why nobody noticed the duplication).
        //
        // Vertical: `py-6` put 24px above the first thing on every phone
        // screen, on top of whatever the topbar already contributes. 16px is
        // enough to separate; anything more is a band of nothing at the top of
        // the fold.
        !noPadding &&
          (width === "app"
            ? "px-[var(--page-x)] py-4 lg:px-8 lg:py-7"
            : "px-[var(--page-x)] py-4 md:py-8"),
        className,
      )}
    >
      {children}
    </div>
  );
}
