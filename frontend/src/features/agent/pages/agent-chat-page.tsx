import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { History, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  useAgentMessages,
  useAgentSessionList,
  useStartFreshSession,
} from "../hooks/use-agent-session";
import { useAgentChat } from "../hooks/use-agent-chat";
import { agentApi } from "../api/agent-api";
import { AgentComposer } from "../components/agent-composer";
import { AgentMessageList } from "../components/agent-message-list";
import { useAgentName } from "@core/branding/agent-branding";
import { formatDayMonth } from "@shared/utils/format";

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - t) / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `hace ${h}h`;
  return formatDayMonth(iso);
}

function deriveTitle(text: string): string {
  const compact = text.trim().replace(/\s+/g, " ");
  if (compact.length <= 40) return compact;
  return `${compact.slice(0, 40).trimEnd()}…`;
}

interface SessionSummary {
  id: string;
  preview?: string;
  last_activity_at: string;
  status: string;
}

/** Conversation list — shared by the desktop rail and the mobile history sheet. */
function SessionList({
  sessions,
  isLoading,
  activeId,
  onPick,
}: {
  sessions: SessionSummary[] | undefined;
  isLoading: boolean;
  activeId: string | undefined;
  onPick: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!sessions || sessions.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        Aún no hay conversaciones.
      </p>
    );
  }
  return (
    <div className="space-y-0.5">
      {sessions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.id)}
          className={`w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-secondary ${
            s.id === activeId ? "bg-secondary" : ""
          }`}
        >
          <p className="line-clamp-1 text-[13px] font-medium text-foreground">
            {s.preview || <span className="italic text-muted-foreground">(sin mensajes)</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {relativeTime(s.last_activity_at)} · {s.status === "OPEN" ? "abierta" : "cerrada"}
          </p>
        </button>
      ))}
    </div>
  );
}

export function AgentChatPage() {
  const agentName = useAgentName();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const startFresh = useStartFreshSession();
  const sessionsQuery = useAgentSessionList();
  const messagesQuery = useAgentMessages(sessionId);
  const chat = useAgentChat(sessionId);
  const [bootError, setBootError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const titledSessionsRef = useRef<Set<string>>(new Set());

  // Fresh session every visit. The dependency-free effect is intentional:
  // we only want this to run on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await agentApi.createOrResumeSession({ forceNew: true });
        if (!cancelled) {
          setSessionId(s.id);
          if (s.title) titledSessionsRef.current.add(s.id);
          queryClient.invalidateQueries({ queryKey: ["agent", "sessions"] });
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : `no se pudo abrir ${agentName}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-title: when the first user message lands and session has no title
  // yet, derive a short one from that message.
  useEffect(() => {
    if (!sessionId) return;
    if (titledSessionsRef.current.has(sessionId)) return;
    const firstUser = messagesQuery.data?.find((m) => m.role === "user");
    if (!firstUser) return;
    const raw =
      typeof firstUser.content === "string"
        ? firstUser.content
        : Array.isArray(firstUser.content)
          ? (firstUser.content.find((b) => b.type === "text")?.text ?? "")
          : ((firstUser.content as { text?: string })?.text ?? "");
    const title = deriveTitle(raw);
    if (!title) return;
    titledSessionsRef.current.add(sessionId);
    void agentApi
      .updateSession(sessionId, { title })
      .then(() => queryClient.invalidateQueries({ queryKey: ["agent", "sessions"] }))
      .catch(() => {
        titledSessionsRef.current.delete(sessionId);
      });
  }, [messagesQuery.data, sessionId, queryClient]);

  const handleNewConversation = async () => {
    if (chat.isStreaming) return;
    chat.reset();
    try {
      const s = await startFresh.mutateAsync();
      setSessionId(s.id);
      if (s.title) titledSessionsRef.current.add(s.id);
    } catch {
      /* leave previous session if it fails */
    }
  };

  const handleOpenHistorySession = (id: string) => {
    chat.reset();
    setSessionId(id);
    titledSessionsRef.current.add(id);
    setHistoryOpen(false);
  };

  const sessions = sessionsQuery.data as SessionSummary[] | undefined;

  return (
    <div className="flex h-[calc(100dvh-var(--app-header-h)-var(--app-nav-h,0px))]">
      {/* The page's own name. Visually redundant next to the header's Propo
          branding, but the document needs one h1 before the rail's h2 or the
          heading outline starts at level 2. */}
      <h1 className="sr-only">{agentName}</h1>
      {/* Desktop: persistent conversations rail */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border lg:flex">
        <div className="flex shrink-0 items-center justify-between px-4 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Conversaciones</h2>
          <Button
            type="button"
            size="sm"
            variant="ink"
            onClick={handleNewConversation}
            disabled={!sessionId || startFresh.isPending || chat.isStreaming}
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
          >
            {startFresh.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <PlusCircle className="size-3.5" />
            )}
            Nueva
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <SessionList
            sessions={sessions}
            isLoading={sessionsQuery.isLoading}
            activeId={sessionId}
            onPick={handleOpenHistorySession}
          />
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only history + new controls (desktop uses the rail) */}
        <div className="flex shrink-0 items-center justify-end gap-1 px-4 py-2 lg:hidden">
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="gap-1 text-xs">
                <History className="size-3.5" />
                Historial
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Conversaciones</SheetTitle>
              </SheetHeader>
              <div className="mt-4 overflow-y-auto pr-1">
                <SessionList
                  sessions={sessions}
                  isLoading={sessionsQuery.isLoading}
                  activeId={sessionId}
                  onPick={handleOpenHistorySession}
                />
              </div>
            </SheetContent>
          </Sheet>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleNewConversation}
            disabled={!sessionId || startFresh.isPending || chat.isStreaming}
            className="gap-1 text-xs"
          >
            {startFresh.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <PlusCircle className="size-3" />
            )}
            Nueva
          </Button>
        </div>

        {bootError ? (
          <p className="p-4 text-sm text-destructive">
            No pude abrir {agentName}: {bootError}
          </p>
        ) : !sessionId ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-hidden px-4">
              <div className="mx-auto h-full max-w-3xl">
                <AgentMessageList
                  messages={messagesQuery.data ?? []}
                  liveText={chat.liveText}
                  isStreaming={chat.isStreaming}
                  isThinking={chat.isThinking}
                  pendingUserText={chat.pendingUserText}
                  pendingAudio={chat.pendingAudio}
                  liveProposals={chat.proposalsCreated}
                />
              </div>
            </div>
            {chat.error && <p className="px-4 text-xs text-destructive">{chat.error}</p>}
            <div className="shrink-0 border-t border-border p-4">
              <div className="mx-auto max-w-3xl">
                <AgentComposer
                  onSend={chat.send}
                  onAudio={chat.submitAudio}
                  isStreaming={chat.isStreaming}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
