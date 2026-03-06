import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { ChatList } from "@features/chat/components/chat-list/chat-list";
import { ChatWindow } from "@features/chat/components/chat-window/chat-window";
import { NewConversationDialog } from "@features/chat/components/new-conversation-dialog/new-conversation-dialog";
import { useConversations } from "@features/chat/hooks/use-conversations";
import { cn } from "@/lib/utils";

interface ChatPageProps {
  basePath: string;
}

export function ChatPage({ basePath }: ChatPageProps) {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { data: conversations } = useConversations();

  const selectedConversation = conversations?.find(
    (c) => c.id === conversationId,
  );

  const handleSelect = useCallback(
    (id: string) => {
      navigate(`${basePath}/${id}`);
    },
    [navigate, basePath],
  );

  const handleBack = useCallback(() => {
    navigate(basePath);
  }, [navigate, basePath]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)]">
      {/* Sidebar / conversation list */}
      <div
        className={cn(
          "flex flex-col border-r w-full md:w-80 md:shrink-0",
          conversationId ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-sm font-semibold">Chat</h1>
          <NewConversationDialog onCreated={handleSelect} />
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatList selectedId={conversationId} onSelect={handleSelect} />
        </div>
      </div>

      {/* Chat window */}
      <div
        className={cn(
          "flex-1 min-w-0",
          conversationId ? "flex" : "hidden md:flex",
        )}
      >
        {selectedConversation ? (
          <div className="flex-1">
            <ChatWindow
              conversation={selectedConversation}
              onBack={handleBack}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageCircle className="size-12 opacity-30" strokeWidth={1} />
            <p className="text-sm">Selecciona una conversacion</p>
          </div>
        )}
      </div>
    </div>
  );
}
