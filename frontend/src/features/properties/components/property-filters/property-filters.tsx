import { Badge } from "@/components/ui/badge";
import type { PropertyStatus } from "@features/properties/types";

const ALL_STATUSES: { value: PropertyStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "RESERVED", label: "Reservada" },
  { value: "SOLD", label: "Vendida" },
  { value: "INACTIVE", label: "Inactiva" },
];

interface PropertyFiltersProps {
  selected: PropertyStatus[];
  onChange: (statuses: PropertyStatus[]) => void;
}

export function PropertyFilters({ selected, onChange }: PropertyFiltersProps) {
  function toggle(status: PropertyStatus) {
    if (selected.includes(status)) {
      onChange(selected.filter((s) => s !== status));
    } else {
      onChange([...selected, status]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_STATUSES.map(({ value, label }) => {
        const isActive = selected.includes(value);
        return (
          <button key={value} type="button" onClick={() => toggle(value)}>
            <Badge
              variant={isActive ? "default" : "outline"}
              className={isActive ? "" : "opacity-60 hover:opacity-100"}
            >
              {label}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
