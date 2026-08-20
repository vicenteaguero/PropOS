import type { ReactNode } from "react";
import { useDismissOnBack } from "@shared/hooks/use-dismiss-on-back";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible title (required by Radix Dialog). Pass `srOnlyTitle` to hide it. */
  title?: ReactNode;
  srOnlyTitle?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Rounded bottom sheet with a drag handle. Built on the shadcn Sheet (side=bottom). */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  srOnlyTitle,
  description,
  children,
  className,
}: BottomSheetProps) {
  // Back dismisses the sheet instead of leaving the page — the behaviour a
  // phone user expects from anything that slides up over the content.
  useDismissOnBack(open, () => onOpenChange(false));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl border-border px-5 pt-3 pb-[calc(var(--safe-bottom)+2rem)]",
          className,
        )}
      >
        {/* A real button, not decoration. The grab handle looked draggable and
            was not, the X was suppressed, and the backdrop is a sliver at
            max-h-92dvh — so the sheet had no reliable way out on a phone. */}
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => onOpenChange(false)}
          className="mx-auto mb-3 flex h-6 w-16 shrink-0 items-center justify-center"
        >
          <span className="h-1.5 w-10 rounded-full bg-line-strong" />
        </button>
        {title ? (
          <SheetTitle className="text-[15px] font-semibold tracking-tight">{title}</SheetTitle>
        ) : (
          <SheetTitle className="sr-only">{srOnlyTitle ?? "Menú"}</SheetTitle>
        )}
        {description && <SheetDescription className="mt-1">{description}</SheetDescription>}
        {children}
      </SheetContent>
    </Sheet>
  );
}
