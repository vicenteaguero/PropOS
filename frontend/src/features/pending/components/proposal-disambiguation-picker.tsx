import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  if (!candidates || candidates.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Anita encontró {candidates.length} coincidencias para{" "}
        <span className="font-mono">{field}</span>. Elige una:
      </p>
      <div className="space-y-1">
        {candidates.map((c) => {
          const label = c.full_name || c.name || c.title || c.id;
          const meta = [c.type, c.kind, c.status, c.phone, c.email, c.address]
            .filter(Boolean)
            .join(" · ");
          const isSelected = selected === c.id;
          return (
            <Card
              key={c.id}
              className={
                "p-2 flex items-center justify-between gap-2 " +
                (isSelected ? "border-primary bg-primary/5" : "")
              }
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{label}</p>
                {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
              </div>
              {isSelected ? (
                <Badge>Elegido</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => onPick(c.id)}>
                  Elegir
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
