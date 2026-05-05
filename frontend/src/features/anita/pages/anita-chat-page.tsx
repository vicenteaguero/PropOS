import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { History, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useAnitaMessages,
  useAnitaSessionList,
  useStartFreshSession,
} from "../hooks/use-anita-session";
import { useAnitaChat } from "../hooks/use-anita-chat";
import { anitaApi } from "../api/anita-api";
import { AnitaComposer } from "../components/anita-composer";
import { AnitaMessageList } from "../components/anita-message-list";

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - t) / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function deriveTitle(text: string): string {
  const compact = text.trim().replace(/\s+/g, " ");
  if (compact.length <= 40) return compact;
  return `${compact.slice(0, 40).trimEnd()}…`;
}

export function AnitaChatPage() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const startFresh = useStartFreshSession();
  const sessionsQuery = useAnitaSessionList();
  const messagesQuery = useAnitaMessages(sessionId);
  const chat = useAnitaChat(sessionId);
  const [bootError, setBootError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const titledSessionsRef = useRef<Set<string>>(new Set());

  // Fresh session every visit. The dependency-free effect is intentional:
  // we only want this to run on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await anitaApi.createOrResumeSession({ forceNew: true });
        if (!cancelled) {
          setSessionId(s.id);
          if (s.title) titledSessionsRef.current.add(s.id);
          queryClient.invalidateQueries({ queryKey: ["anita", "sessions"] });
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : "no se pudo abrir Anita");
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
    void anitaApi
      .updateSession(sessionId, { title })
      .then(() => queryClient.invalidateQueries({ queryKey: ["anita", "sessions"] }))
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

  return (
    <div className="flex h-[calc(100dvh-var(--app-header-h))] flex-col">
      <div className="flex shrink-0 items-center justify-end gap-1 px-4 py-2">
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1 text-xs"
              title="Historial"
            >
              <History className="size-3" />
              <span className="hidden sm:inline">Historial</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-sm sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Conversaciones</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1 overflow-y-auto pr-1">
              {sessionsQuery.isLoading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {sessionsQuery.data?.length === 0 && (
                <p className="text-xs text-muted-foreground">Aún no hay conversaciones.</p>
              )}
              {sessionsQuery.data?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleOpenHistorySession(s.id)}
                  className={`w-full rounded-md border border-transparent px-2 py-2 text-left text-xs transition hover:bg-muted ${
                    s.id === sessionId ? "border-border bg-muted" : ""
                  }`}
                >
                  <p className="line-clamp-2 font-medium text-foreground">
                    {s.preview || <span className="italic text-muted-foreground">(sin mensajes)</span>}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {relativeTime(s.last_activity_at)} · {s.status === "OPEN" ? "abierta" : "cerrada"}
                  </p>
                </button>
              ))}
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
          title="Nueva conversación"
        >
          {startFresh.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <PlusCircle className="size-3" />
          )}
          <span className="hidden sm:inline">Nueva</span>
        </Button>
      </div>

      {bootError ? (
        <p className="p-4 text-sm text-destructive">No pude abrir Anita: {bootError}</p>
      ) : !sessionId ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-hidden px-4">
            <div className="mx-auto h-full max-w-3xl">
              <AnitaMessageList
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
              <AnitaComposer
                onSend={chat.send}
                onAudio={chat.submitAudio}
                isStreaming={chat.isStreaming}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
