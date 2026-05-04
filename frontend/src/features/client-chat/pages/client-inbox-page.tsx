import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useConversations } from "../hooks/use-client-chat";
import { ConversationList } from "../components/conversation-list";
import { MessageThread } from "../components/message-thread";
import type { ConversationStatus } from "../types";

const TABS: { value: ConversationStatus | "all"; label: string }[] = [
  { value: "open", label: "Abiertas" },
  { value: "assigned", label: "Asignadas" },
  { value: "closed", label: "Cerradas" },
  { value: "all", label: "Todas" },
];

export function ClientInboxPage() {
  const [tab, setTab] = useState<ConversationStatus | "all">("open");
  const { data: conversations = [], isLoading } = useConversations(
    tab === "all" ? undefined : tab,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  return (
    <div className="container max-w-6xl py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Inbox de clientes</h1>
        <p className="text-sm text-muted-foreground">
          Conversaciones por WhatsApp gestionadas por la IA cliente. Tomá control cuando haga falta.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={tab === t.value ? "default" : "outline"}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <div>
          {isLoading ? (
            <Card className="flex justify-center p-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </Card>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        <div className="min-h-[60vh]">
          {selected ? (
            <MessageThread conversation={selected} />
          ) : (
            <Card className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Seleccioná una conversación.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
