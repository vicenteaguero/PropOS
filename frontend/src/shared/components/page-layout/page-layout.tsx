import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageWidth = "sm" | "md" | "lg" | "xl" | "full";

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
          "flex min-h-[calc(100dvh-var(--app-header-h,0px))] w-full items-center justify-center",
          !noPadding && "px-4 py-6 md:px-6 md:py-8",
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
        !noPadding && "px-4 py-6 md:px-6 md:py-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
