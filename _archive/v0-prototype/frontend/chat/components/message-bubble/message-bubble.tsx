import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message } from "@features/chat/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const senderName = message.sender?.fullName ?? "Usuario";

  return (
    <div className={cn("flex gap-2 px-4", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && (
        <Avatar size="sm" className="mt-1 shrink-0">
          <AvatarFallback className="text-[10px]">
            {getInitials(senderName)}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex max-w-[75%] flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
        {!isOwn && (
          <span className="text-[11px] font-medium text-muted-foreground px-1">
            {senderName}
          </span>
        )}
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm leading-relaxed",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md",
          )}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
