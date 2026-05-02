import { useEffect, useRef } from "react";
import { AnitaInlineProposalCard } from "./anita-inline-proposal-card";
import type { AnitaMessage } from "../types";

interface Props {
  messages: AnitaMessage[];
  liveText: string;
  isStreaming: boolean;
  isThinking: boolean;
  pendingUserText: string | null;
  liveProposals: string[];
}

interface Block {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  tool_use_id?: string;
}

/** Robustly extract human-readable text from any shape Supabase JSONB
 *  might return: string, {text:"..."}, [{type:"text",text:"..."}], etc. */
function extractText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") {
    // Sometimes JSONB returns the string with JSON wrapping; unwrap once.
    if (content.startsWith("{") || content.startsWith("[")) {
      try {
        return extractText(JSON.parse(content));
      } catch {
        return content;
      }
    }
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((b: Block) => {
        if (b?.type === "text") return b.text || "";
        if (typeof b === "string") return b;
        return "";
      })
      .filter(Boolean)
      .join("");
  }
  if (typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.content)) return extractText(obj.content);
  }
  return "";
}

function extractTools(content: unknown): { name: string }[] {
  if (Array.isArray(content)) {
    return (content as Block[])
      .filter((b) => b?.type === "tool_use")
      .map((b) => ({ name: b.name || "?" }));
  }
  if (typeof content === "string") {
    if (content.startsWith("{") || content.startsWith("[")) {
      try {
        return extractTools(JSON.parse(content));
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function AnitaMessageList({
  messages,
  liveText,
  isStreaming,
  isThinking,
  pendingUserText,
  liveProposals,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, liveText, liveProposals, pendingUserText, isThinking]);

  const renderable = messages.filter((m) => m.role === "user" || m.role === "assistant");

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">
      <div className="space-y-3 py-2">
        {renderable.map((m) => {
          const text = extractText(m.content);
          const tools = extractTools(m.content);
          if (!text && tools.length === 0) return null;
          return (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "rounded-lg bg-primary/10 px-3 py-2 ml-6 text-sm"
                  : "rounded-lg bg-muted px-3 py-2 mr-6 text-sm"
              }
            >
              {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
              {tools.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {tools.map((t) => `🔧 ${t.name}`).join(" · ")}
                </p>
              )}
            </div>
          );
        })}

        {pendingUserText && (
          <div className="rounded-lg bg-primary/10 px-3 py-2 ml-6 text-sm whitespace-pre-wrap break-words">
            {pendingUserText}
          </div>
        )}

        {isThinking && (
          <div className="rounded-lg bg-muted px-3 py-2 mr-6 text-sm flex items-center gap-2">
            <span className="inline-flex gap-1">
              <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" />
              <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:300ms]" />
            </span>
            <span className="text-xs text-muted-foreground">Anita está pensando…</span>
          </div>
        )}

        {isStreaming && liveText && (
          <div className="rounded-lg bg-muted px-3 py-2 mr-6 text-sm">
            <p className="whitespace-pre-wrap break-words">{liveText}</p>
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
    </div>
  );
}
