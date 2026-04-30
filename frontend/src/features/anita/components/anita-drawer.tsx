import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAnitaSession, useAnitaMessages } from "../hooks/use-anita-session";
import { useAnitaChat } from "../hooks/use-anita-chat";
import { AnitaComposer } from "./anita-composer";
import { AnitaMessageList } from "./anita-message-list";
import { Sparkles, Loader2 } from "lucide-react";

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-4 gap-3"
      >
        <SheetHeader className="space-y-1 px-0">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Anita
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Habla o escribe. Yo dejo todo pendiente para que revises.
          </p>
        </SheetHeader>

        {sessionQuery.isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessionQuery.isError ? (
          <p className="text-sm text-destructive">
            No pude abrir tu sesión. Recarga e intenta de nuevo.
          </p>
        ) : (
          <>
            <AnitaMessageList
              messages={messagesQuery.data ?? []}
              liveText={chat.liveText}
              isStreaming={chat.isStreaming}
              liveProposals={chat.proposalsCreated}
            />
            {chat.error && (
              <p className="text-xs text-destructive">{chat.error}</p>
            )}
            <AnitaComposer
              onSend={chat.send}
              isStreaming={chat.isStreaming}
              autoSend={autoSend}
              sessionId={sessionId}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
