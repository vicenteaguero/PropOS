import type { ReactNode } from "react";
import { useDismissOnBack } from "@shared/hooks/use-dismiss-on-back";
import { useSheetDrag } from "@shared/hooks/use-sheet-drag";
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

/**
 * Rounded bottom sheet. Built on the shadcn Sheet (side=bottom).
 *
 * Dismissed three ways, because a phone user will try all three: the system
 * Back gesture, tapping the handle, and dragging it down.
 */
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
  const drag = useSheetDrag(() => onOpenChange(false));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        {...drag.handlers}
        style={drag.style}
        className={cn(
          "max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl border-border px-5 pt-3 pb-[calc(var(--safe-bottom)+2rem)]",
          // While a finger is on it the sheet must track the finger exactly;
          // Radix's own `transition` would lag every frame behind.
          drag.dragging && "transition-none",
          className,
        )}
      >
        {/* Both a drag affordance and a button. It IS draggable now (see
            useSheetDrag), and it stays tappable because a handle that only
            responds to a gesture is invisible to anyone who does not try it —
            and the backdrop is a sliver at max-h-92dvh. */}
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => onOpenChange(false)}
          // 44px tall, not 24: the visible handle stays a thin bar but the hit
          // area has to clear the touch floor, or the only obvious way out of
          // the sheet is a target too small to hit reliably.
          className="mx-auto -mt-1 mb-1 flex h-11 w-16 shrink-0 items-center justify-center"
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
