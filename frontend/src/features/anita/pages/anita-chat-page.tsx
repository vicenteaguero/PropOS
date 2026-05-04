import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PlusCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnitaSession, useAnitaMessages } from "../hooks/use-anita-session";
import { useAnitaChat } from "../hooks/use-anita-chat";
import { anitaApi } from "../api/anita-api";
import { AnitaComposer } from "../components/anita-composer";
import { AnitaMessageList } from "../components/anita-message-list";

export function AnitaChatPage() {
  const sessionQuery = useAnitaSession();
  const sessionId = sessionQuery.data?.id;
  const messagesQuery = useAnitaMessages(sessionId);
  const chat = useAnitaChat(sessionId);
  const [autoSend] = useState(true);
  const [closing, setClosing] = useState(false);
  const queryClient = useQueryClient();

  const handleNewConversation = async () => {
    if (!sessionId || closing) return;
    setClosing(true);
    try {
      await anitaApi.updateSession(sessionId, { status: "CLOSED" });
    } catch {
      /* even if close fails, force-resume */
    }
    chat.reset();
    await queryClient.invalidateQueries({ queryKey: ["anita", "session"] });
    queryClient.removeQueries({ queryKey: ["anita", "messages"] });
    setClosing(false);
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Anita</h1>
            <p className="text-xs text-muted-foreground">
              Habla o escribe. Yo dejo todo pendiente para que revises.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleNewConversation}
          disabled={!sessionId || closing || chat.isStreaming}
          className="gap-1 text-xs"
          title="Nueva conversación"
        >
          {closing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <PlusCircle className="size-3" />
          )}
          Nueva
        </Button>
      </header>

      {sessionQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : sessionQuery.isError ? (
        <p className="p-4 text-sm text-destructive">
          No pude abrir tu sesión. Recarga e intenta de nuevo.
        </p>
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
                liveProposals={chat.proposalsCreated}
              />
            </div>
          </div>
          {chat.error && <p className="px-4 text-xs text-destructive">{chat.error}</p>}
          <div className="shrink-0 border-t border-border p-4">
            <div className="mx-auto max-w-3xl">
              <AnitaComposer
                onSend={chat.send}
                isStreaming={chat.isStreaming}
                autoSend={autoSend}
                sessionId={sessionId}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
