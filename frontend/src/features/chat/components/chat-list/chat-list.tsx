import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversations } from "@features/chat/hooks/use-conversations";
import { useAuth } from "@shared/hooks/use-auth";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import type { Conversation } from "@features/chat/types";
import { cn } from "@/lib/utils";

interface ChatListProps {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

function getConversationDisplayName(conv: Conversation, currentUserId: string): string {
  if (conv.title) return conv.title;
  const others =
    conv.participants?.filter((p) => p.userId !== currentUserId) ?? [];
  if (others.length === 0) return "Conversacion";
  return others
    .map((p) => p.profile?.fullName ?? "Usuario")
    .join(", ");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function ChatList({ selectedId, onSelect }: ChatListProps) {
  const { data: conversations, isLoading } = useConversations();
  const { user } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  if (!conversations?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm text-muted-foreground">No hay conversaciones</p>
        <p className="text-xs text-muted-foreground mt-1">
          Crea una nueva para empezar
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">
        {conversations.map((conv) => {
          const displayName = getConversationDisplayName(conv, user?.id ?? "");
          const lastMsg = conv.lastMessage;
          const isSelected = conv.id === selectedId;

          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                isSelected && "bg-accent",
              )}
            >
              <Avatar>
                <AvatarFallback className="text-xs">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{displayName}</span>
                  {lastMsg && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelativeTime(lastMsg.createdAt)}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {lastMsg.content}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
