import { Chips, Chip } from "@shared/ui";

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
    <Chips>
      {OPTIONS.map((opt) => (
        <Chip key={opt.value} active={value === opt.value} onClick={() => onChange(opt.value)}>
          {opt.label}
        </Chip>
      ))}
    </Chips>
  );
}
