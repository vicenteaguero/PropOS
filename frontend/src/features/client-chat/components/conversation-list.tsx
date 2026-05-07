import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, MessageCircle } from "lucide-react";
import { WhatsAppIcon } from "@shared/components/icons/whatsapp-icon";
import { useArchiveConversation } from "../hooks/use-client-chat";
import type { ClientConversation, ChannelSource, ConversationStatus } from "../types";

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

function ChannelIcon({ source }: { source: ChannelSource }) {
  if (source === "whatsapp") return <WhatsAppIcon className="size-3.5" aria-label="WhatsApp" />;
  return <MessageCircle className="size-3.5" aria-label={source} />;
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  const archive = useArchiveConversation();

  if (conversations.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">Sin conversaciones.</Card>
    );
  }
  return (
    <div className="space-y-1">
      {conversations.map((c) => {
        const isArchived = !!c.archived_at;
        return (
          <div
            key={c.id}
            className={`group flex items-stretch gap-1 rounded-md border ${
              selectedId === c.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
            }`}
          >
            <button type="button" onClick={() => onSelect(c.id)} className="flex-1 p-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <ChannelIcon source={c.source} />
                  {c.external_phone_e164 ?? "(sin número)"}
                </span>
                <Badge variant="outline" className={STATUS_CLASS[c.status]}>
                  {STATUS_LABEL[c.status]}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {c.ai_enabled ? <span>IA on</span> : <span>IA off</span>}
                <span>· {new Date(c.last_message_at).toLocaleString()}</span>
              </div>
            </button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="m-1 size-7 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                archive.mutate({ id: c.id, archived: !isArchived });
              }}
              title={isArchived ? "Restaurar" : "Archivar"}
            >
              {isArchived ? (
                <ArchiveRestore className="size-3.5" />
              ) : (
                <Archive className="size-3.5" />
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
