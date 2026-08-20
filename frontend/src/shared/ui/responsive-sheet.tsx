import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useIsDesktop } from "@/hooks/use-mobile";
import { BottomSheet } from "./bottom-sheet";
import { cn } from "@/lib/utils";

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  /** Accessible name when no title should be painted (Radix requires one either way). */
  srOnlyTitle?: string;
  description?: ReactNode;
  children: ReactNode;
  /** Applied to both presentations. */
  className?: string;
  /**
   * Desktop-only classes — width caps in particular. A `max-w-md` meant for a
   * centered modal must not follow the layout down to a bottom sheet, which is
   * full-bleed by design and would otherwise render as a floating card.
   */
  desktopClassName?: string;
}

/**
 * One overlay primitive, two presentations: a bottom sheet on phones and a
 * centered modal from tablet up. Use for every create/detail flow so each
 * platform gets its native feel from a single call site.
 *
 * Fifteen dialogs bypassed this and reached for the raw shadcn `Dialog`, which
 * meant a phone got a centered desktop modal — the exact failure this exists to
 * prevent. Prefer it over `Dialog` unless the surface is genuinely full-screen
 * (a camera viewfinder, say).
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  srOnlyTitle,
  description,
  children,
  className,
  desktopClassName,
}: ResponsiveSheetProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-w-lg", className, desktopClassName)}>
          {title || description ? (
            <DialogHeader>
              {title && <DialogTitle>{title}</DialogTitle>}
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          ) : (
            // Radix warns (and screen readers get nothing) without a title, so a
            // titleless dialog still carries one — just unpainted.
            <DialogTitle className="sr-only">{srOnlyTitle ?? "Detalle"}</DialogTitle>
          )}
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      srOnlyTitle={srOnlyTitle}
      description={description}
      className={className}
    >
      {children}
    </BottomSheet>
  );
}
