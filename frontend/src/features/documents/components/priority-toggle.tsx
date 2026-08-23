import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_HIT_AREA } from "@shared/ui";
import { useToggleDocumentPriority } from "../hooks/use-documents";
import type { DocumentItem } from "../types";

/**
 * Mark a document as priority without opening it.
 *
 * The flag could only be set from the overflow menu inside the detail page,
 * which is backwards: you decide something matters while looking at the list of
 * everything, not after committing to open one of them.
 *
 * `stopPropagation` because this sits inside the card's own button — the card
 * navigates, the star does not.
 */
export function PriorityToggle({ doc, className }: { doc: DocumentItem; className?: string }) {
  const toggle = useToggleDocumentPriority();
  const on = !!doc.is_priority;
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={on ? "Quitar prioridad" : "Marcar prioritario"}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle.mutate({ id: doc.id, next: !on });
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.stopPropagation();
        e.preventDefault();
        toggle.mutate({ id: doc.id, next: !on });
      }}
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center rounded-full transition active:scale-90",
        TOUCH_TARGET_HIT_AREA,
        on ? "text-warning" : "text-muted-foreground/50 hover:text-foreground",
        className,
      )}
    >
      <Star className="size-4" strokeWidth={2} fill={on ? "currentColor" : "none"} />
    </span>
  );
}
