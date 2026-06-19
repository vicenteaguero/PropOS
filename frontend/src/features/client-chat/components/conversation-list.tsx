import { Archive, ArchiveRestore } from "lucide-react";
import { BrandMark, Pill, type PillTone, RoundButton, Row } from "@shared/ui";
import { useArchiveConversation } from "../hooks/use-client-chat";
import type { ClientConversation, ConversationStatus } from "../types";

const STATUS_LABEL: Record<ConversationStatus, string> = {
  open: "Abierta",
  assigned: "Asignada",
  closed: "Cerrada",
};

const STATUS_TONE: Record<ConversationStatus, PillTone> = {
  open: "success",
  assigned: "accent",
  closed: "neutral",
};

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  conversations: ClientConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  const archive = useArchiveConversation();

  if (conversations.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">Sin conversaciones.</p>
    );
  }

  return (
    <div>
      {conversations.map((c, i) => {
        const isArchived = !!c.archived_at;
        const selected = selectedId === c.id;
        return (
          // Wrapper keeps the archive control a sibling of the row button (no nested buttons).
          <div key={c.id} className="group relative">
            <Row
              divider={i < conversations.length - 1}
              onClick={() => onSelect(c.id)}
              className={selected ? "bg-secondary/60" : undefined}
              left={
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <BrandMark brand={c.source === "whatsapp" ? "whatsapp" : "email"} size={26} />
                </span>
              }
              title={c.external_phone_e164 ?? "(sin número)"}
              sub={
                <span className="flex items-center gap-1.5">
                  <span>{c.ai_enabled ? "IA on" : "IA off"}</span>
                  <span aria-hidden>·</span>
                  <span>{fmtTime(c.last_message_at)}</span>
                </span>
              }
              right={
                <span className="flex shrink-0 items-center gap-2">
                  <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
                  {/* spacer so the row's content never sits under the archive button */}
                  <span className="size-8 shrink-0" aria-hidden />
                </span>
              }
            />
            <RoundButton
              tone="ghost"
              size={32}
              aria-label={isArchived ? "Restaurar" : "Archivar"}
              title={isArchived ? "Restaurar" : "Archivar"}
              className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                archive.mutate({ id: c.id, archived: !isArchived });
              }}
            >
              {isArchived ? (
                <ArchiveRestore className="size-4" strokeWidth={1.8} />
              ) : (
                <Archive className="size-4" strokeWidth={1.8} />
              )}
            </RoundButton>
          </div>
        );
      })}
    </div>
  );
}
