import { Check } from "lucide-react";
import { Pill } from "@shared/ui";
import { cn } from "@/lib/utils";
import { useAgentName } from "@core/branding/agent-branding";

interface Candidate {
  id: string;
  full_name?: string;
  name?: string;
  title?: string;
  type?: string;
  kind?: string;
  status?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface Props {
  field: string; // e.g. "person_id" or "campaign_id"
  candidates: Candidate[];
  selected?: string;
  onPick: (candidateId: string) => void;
}

export function ProposalDisambiguationPicker({ field, candidates, selected, onPick }: Props) {
  const agentName = useAgentName();
  if (!candidates || candidates.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {agentName} encontró {candidates.length} coincidencias para{" "}
        <span className="font-mono text-faint">{field}</span>. Elige una:
      </p>
      <div className="space-y-1.5">
        {candidates.map((c) => {
          const label = c.full_name || c.name || c.title || c.id;
          const meta = [c.type, c.kind, c.status, c.phone, c.email, c.address]
            .filter(Boolean)
            .join(" · ");
          const isSelected = selected === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              aria-pressed={isSelected}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                isSelected
                  ? "border-foreground bg-secondary"
                  : "border-border hover:bg-secondary/50 active:scale-[0.99]",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
              </div>
              {isSelected ? (
                <Pill tone="accent">
                  <Check className="size-3" strokeWidth={1.8} />
                  Elegido
                </Pill>
              ) : (
                <span className="shrink-0 text-xs font-semibold text-primary">Elegir</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
