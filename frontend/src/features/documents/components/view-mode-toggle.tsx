import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "../types";

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5">
      <Button
        size="sm"
        variant={value === "grid" ? "secondary" : "ghost"}
        className="h-8 px-2"
        onClick={() => onChange("grid")}
        aria-label="Vista en grilla"
      >
        <LayoutGrid className="size-4" />
      </Button>
      <Button
        size="sm"
        variant={value === "list" ? "secondary" : "ghost"}
        className="h-8 px-2"
        onClick={() => onChange("list")}
        aria-label="Vista en lista"
      >
        <List className="size-4" />
      </Button>
    </div>
  );
}
