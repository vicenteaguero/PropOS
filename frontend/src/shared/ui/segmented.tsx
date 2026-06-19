import { cn } from "@/lib/utils";

export interface SegmentedItem {
  id: string;
  label: string;
}

interface SegmentedProps {
  items: SegmentedItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Underline tab bar (Uber-style). Controlled. */
export function Segmented({ items, value, onChange, className }: SegmentedProps) {
  return (
    <div className={cn("flex gap-5 border-b border-border px-5", className)}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              "relative -mb-px border-b-2 pb-3 text-[15px] transition-colors",
              active
                ? "border-foreground font-bold text-foreground"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
