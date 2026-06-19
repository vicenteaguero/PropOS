import { LayoutGrid, List } from "lucide-react";
import { RoundButton } from "@shared/ui";
import type { ViewMode } from "../types";

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex shrink-0 gap-1">
      <RoundButton
        size={36}
        tone={value === "grid" ? "ink" : "muted"}
        onClick={() => onChange("grid")}
        aria-label="Vista en grilla"
        aria-pressed={value === "grid"}
      >
        <LayoutGrid className="size-4" strokeWidth={1.8} />
      </RoundButton>
      <RoundButton
        size={36}
        tone={value === "list" ? "ink" : "muted"}
        onClick={() => onChange("list")}
        aria-label="Vista en lista"
        aria-pressed={value === "list"}
      >
        <List className="size-4" strokeWidth={1.8} />
      </RoundButton>
    </div>
  );
}
