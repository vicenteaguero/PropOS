import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages } from "@features/chat/hooks/use-messages";
import { useSendMessage } from "@features/chat/hooks/use-send-message";
import { useAuth } from "@shared/hooks/use-auth";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { MessageBubble } from "@features/chat/components/message-bubble/message-bubble";
import type { Conversation } from "@features/chat/types";

interface ChatWindowProps {
  conversation: Conversation;
  onBack?: () => void;
}

export function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const { data: messages, isLoading } = useMessages(conversation.id);
  const { mutate: send, isPending: isSending } = useSendMessage();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayName =
    conversation.title ??
    conversation.participants
      ?.filter((p) => p.userId !== user?.id)
      .map((p) => p.profile?.fullName ?? "Usuario")
      .join(", ") ??
    "Chat";

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    send({ conversationId: conversation.id, content: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden">
            <ArrowLeft className="size-5" />
          </Button>
        )}
        <h2 className="truncate text-sm font-semibold">{displayName}</h2>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="flex flex-col gap-3 py-4">
          {isLoading && <LoadingSpinner />}
          {!isLoading && messages?.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              No hay mensajes. Inicia la conversacion.
            </p>
          )}
          {messages?.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === user?.id}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isSending}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
