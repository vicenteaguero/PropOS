import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

export function ClientInboxPage() {
  // Default filter: active/open conversations.
  const [tab, setTab] = useState<ConversationStatus | "all">("open");
  const [query, setQuery] = useState("");
  const { data: conversations = [], isLoading } = useConversations(tab === "all" ? undefined : tab);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default time-window: last 30 days (filter client-side).
  const filtered = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const t = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
      if (t && t < cutoff) return false;
      if (!q) return true;
      return (c.external_phone_e164 ?? "").toLowerCase().includes(q);
    });
  }, [conversations, query]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[20rem_1fr]"
      style={{ height: "calc(100dvh - var(--app-header-h))" }}
    >
      {/* Left column: filters + conversation list */}
      <aside className="flex min-h-0 flex-col border-r border-border bg-background">
        <div className="space-y-3 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar teléfono..."
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={tab === t.value ? "default" : "outline"}
                onClick={() => setTab(t.value)}
                className="h-7 rounded-full px-3 text-xs"
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ConversationList
              conversations={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </aside>

      {/* Right column: active chat */}
      <section className="flex min-h-0 min-w-0 flex-col bg-background">
        {selected ? (
          <MessageThread conversation={selected} />
        ) : (
          <Card className="m-4 flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            Seleccioná una conversación.
          </Card>
        )}
      </section>
    </div>
  );
}
