import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClientConversation } from "../types";

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
            <Badge variant={c.status === "open" ? "default" : "outline"}>{c.status}</Badge>
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
