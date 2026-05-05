import { Button } from "@/components/ui/button";

export type GroupByMode = "all" | "property" | "contact";

interface Props {
  value: GroupByMode;
  onChange: (mode: GroupByMode) => void;
}

const OPTIONS: Array<{ value: GroupByMode; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "property", label: "Por propiedad" },
  { value: "contact", label: "Por contacto" },
];

export function GroupByToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          size="sm"
          variant={value === opt.value ? "secondary" : "ghost"}
          className="h-8 px-3 text-xs"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
