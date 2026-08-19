import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The action row at the foot of a `ResponsiveSheet`.
 *
 * Column-reverse on phones so the primary action sits closest to the thumb and
 * lands under it without a stretch; a right-aligned row from `sm` up, matching
 * the desktop dialog convention. `column-reverse` rather than reordering in
 * markup keeps the DOM in reading order — confirm before cancel — so tab order
 * and screen-reader order stay correct in both presentations.
 */
export function SheetActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  );
}
