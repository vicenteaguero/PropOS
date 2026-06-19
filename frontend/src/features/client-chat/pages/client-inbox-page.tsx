import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { BrandMark, Chip, Chips, MasterDetail, Segmented, type SegmentedItem } from "@shared/ui";
import { useConversations } from "../hooks/use-client-chat";
import { ConversationList } from "../components/conversation-list";
import { ConversationAside } from "../components/conversation-aside";
import { MessageThread } from "../components/message-thread";
import type { ConversationStatus } from "../types";

const STATUS_TABS: SegmentedItem[] = [
  { id: "open", label: "Abiertas" },
  { id: "assigned", label: "Asignadas" },
  { id: "closed", label: "Cerradas" },
  { id: "all", label: "Todas" },
];

const VIEW_CHIPS: { value: "active" | "archived"; label: string }[] = [
  { value: "active", label: "Activas" },
  { value: "archived", label: "Archivadas" },
];

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

export function ClientInboxPage() {
  // Default filter: active/open conversations.
  const [view, setView] = useState<"active" | "archived">("active");
  const [tab, setTab] = useState<ConversationStatus | "all">("open");
  const [query, setQuery] = useState("");
  const { data: conversations = [], isLoading } = useConversations(
    tab === "all" ? undefined : tab,
    view === "archived",
  );
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

  // Left column: filters + conversation list.
  const list = (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          <BrandMark brand="whatsapp" size={22} />
        </span>
        <h1 className="text-[25px] font-bold leading-tight tracking-tight text-foreground">
          WhatsApp
        </h1>
      </div>

      <div className="space-y-3 px-5 pb-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.8}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar teléfono..."
            className="h-11 w-full rounded-full border border-border bg-secondary pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-line-strong"
          />
        </div>
        <Chips>
          {VIEW_CHIPS.map((v) => (
            <Chip key={v.value} active={view === v.value} onClick={() => setView(v.value)}>
              {v.label}
            </Chip>
          ))}
        </Chips>
      </div>

      <Segmented
        items={STATUS_TABS}
        value={tab}
        onChange={(id) => setTab(id as ConversationStatus | "all")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-10">
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
    </div>
  );

  return (
    <MasterDetail
      selected={!!selected}
      list={list}
      detail={
        selected ? (
          <MessageThread conversation={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Seleccioná una conversación.
          </div>
        )
      }
      aside={selected ? <ConversationAside conversation={selected} /> : undefined}
    />
  );
}
