import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClientConversation, ConversationStatus } from "../types";

const STATUS_LABEL: Record<ConversationStatus, string> = {
  open: "Abierta",
  assigned: "Asignada",
  closed: "Cerrada",
};

const STATUS_CLASS: Record<ConversationStatus, string> = {
  open: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  assigned: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
  closed: "bg-muted text-muted-foreground border border-border",
};

interface Props {
  conversations: ClientConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Sin conversaciones todavía.
      </Card>
    );
  }
  return (
    <div className="space-y-1">
      {conversations.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={`w-full rounded-md border p-3 text-left transition ${
            selectedId === c.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{c.external_phone_e164 ?? "(sin número)"}</span>
            <Badge variant="outline" className={STATUS_CLASS[c.status]}>
              {STATUS_LABEL[c.status]}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{c.source}</span>
            {c.ai_enabled ? <span>· IA on</span> : <span>· IA off</span>}
            <span>· {new Date(c.last_message_at).toLocaleString()}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
