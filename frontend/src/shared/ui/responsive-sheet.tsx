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
          {(title || description) && (
            <DialogHeader>
              {title && <DialogTitle>{title}</DialogTitle>}
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
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
      description={description}
      className={className}
    >
      {children}
    </BottomSheet>
  );
}
