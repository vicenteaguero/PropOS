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
  className?: string;
}

/**
 * One overlay primitive, two presentations: a bottom sheet on mobile (<lg) and
 * a centered modal dialog on desktop (>=lg). Use for create/detail flows so
 * each platform gets its native feel from a single call site.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ResponsiveSheetProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-w-lg", className)}>
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
