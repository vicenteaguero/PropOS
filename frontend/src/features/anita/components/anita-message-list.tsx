import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnitaInlineProposalCard } from "./anita-inline-proposal-card";
import type { AnitaMessage } from "../types";

interface Props {
  messages: AnitaMessage[];
  liveText: string;
  isStreaming: boolean;
  liveProposals: string[];
}

function blockText(content: AnitaMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("");
  }
  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text: unknown }).text || "");
  }
  return "";
}

function blockToolUses(content: AnitaMessage["content"]): { name: string }[] {
  if (Array.isArray(content)) {
    return content.filter((b) => b.type === "tool_use").map((b) => ({ name: b.name || "?" }));
  }
  return [];
}

export function AnitaMessageList({
  messages,
  liveText,
  isStreaming,
  liveProposals,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, liveText, liveProposals]);

  return (
    <ScrollArea className="flex-1 pr-3">
      <div ref={scrollRef} className="space-y-3 py-2">
        {messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => {
            const text = blockText(m.content);
            const tools = blockToolUses(m.content);
            return (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "rounded-lg bg-primary/10 px-3 py-2 ml-6 text-sm"
                    : "rounded-lg bg-muted px-3 py-2 mr-6 text-sm"
                }
              >
                {text && <p className="whitespace-pre-wrap">{text}</p>}
                {tools.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {tools.map((t) => `🔧 ${t.name}`).join(" · ")}
                  </p>
                )}
              </div>
            );
          })}

        {isStreaming && liveText && (
          <div className="rounded-lg bg-muted px-3 py-2 mr-6 text-sm">
            <p className="whitespace-pre-wrap">{liveText}</p>
            <p className="text-xs text-muted-foreground">▍</p>
          </div>
        )}

        {liveProposals.length > 0 && (
          <div className="space-y-2 mr-6">
            {liveProposals.map((id) => (
              <AnitaInlineProposalCard key={id} proposalId={id} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
