import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAnitaSession, useAnitaMessages } from "../hooks/use-anita-session";
import { useAnitaChat } from "../hooks/use-anita-chat";
import { anitaApi } from "../api/anita-api";
import { AnitaComposer } from "./anita-composer";
import { AnitaMessageList } from "./anita-message-list";
import { Sparkles, Loader2, PlusCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnitaDrawer({ open, onOpenChange }: Props) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md h-dvh flex flex-col p-0 gap-0">
        <SheetHeader className="px-4 py-3 border-b border-border space-y-1 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Anita
            </SheetTitle>
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
          </div>
          <p className="text-xs text-muted-foreground">
            Habla o escribe. Yo dejo todo pendiente para que revises.
          </p>
        </SheetHeader>

        {sessionQuery.isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessionQuery.isError ? (
          <p className="p-4 text-sm text-destructive">
            No pude abrir tu sesión. Recarga e intenta de nuevo.
          </p>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-hidden px-4">
              <AnitaMessageList
                messages={messagesQuery.data ?? []}
                liveText={chat.liveText}
                isStreaming={chat.isStreaming}
                isThinking={chat.isThinking}
                pendingUserText={chat.pendingUserText}
                liveProposals={chat.proposalsCreated}
              />
            </div>
            {chat.error && <p className="px-4 text-xs text-destructive">{chat.error}</p>}
            <div className="p-4 border-t border-border shrink-0">
              <AnitaComposer
                onSend={chat.send}
                isStreaming={chat.isStreaming}
                autoSend={autoSend}
                sessionId={sessionId}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
