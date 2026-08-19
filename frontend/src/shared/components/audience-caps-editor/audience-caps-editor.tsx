import { useMemo } from "react";

export type AudienceCaps = Record<string, string[]>;

interface Props {
  audiences: string[]; // e.g. ["owner", "agent", "buyer"]
  caps: string[]; // e.g. ["view", "download"]
  value: AudienceCaps;
  onChange: (next: AudienceCaps) => void;
  capLabels?: Record<string, string>;
  audienceLabels?: Record<string, string>;
}

export function AudienceCapsEditor({
  audiences,
  caps,
  value,
  onChange,
  capLabels = {},
  audienceLabels = {},
}: Props) {
  const matrix = useMemo(() => value ?? {}, [value]);

  function toggle(audience: string, cap: string) {
    const current = matrix[audience] ?? [];
    const has = current.includes(cap);
    const next = has ? current.filter((c) => c !== cap) : [...current, cap];
    const out = { ...matrix };
    if (next.length === 0) {
      delete out[audience];
    } else {
      out[audience] = next;
    }
    onChange(out);
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 text-left">
            <th scope="col" className="p-2 font-medium">
              Audiencia
            </th>
            {caps.map((c) => (
              <th key={c} scope="col" className="p-2 font-medium text-center">
                {capLabels[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {audiences.map((a) => (
            <tr key={a} className="border-t border-border">
              <th scope="row" className="p-2 text-left font-medium">
                {audienceLabels[a] ?? a}
              </th>
              {caps.map((c) => {
                const checked = matrix[a]?.includes(c) ?? false;
                return (
                  <td key={c} className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(a, c)}
                      // Row and column headers alone leave the control unnamed
                      // in most screen readers; name the intersection outright.
                      aria-label={`${audienceLabels[a] ?? a}: ${capLabels[c] ?? c}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
