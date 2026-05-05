import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { AnitaInlineProposalCard } from "./anita-inline-proposal-card";
import type { AnitaMessage } from "../types";

export interface PendingAudioMessage {
  id: string;
  url: string;
  transcribing: boolean;
  transcript: string | null;
  error: string | null;
}

interface Props {
  messages: AnitaMessage[];
  liveText: string;
  isStreaming: boolean;
  isThinking: boolean;
  pendingUserText: string | null;
  pendingAudio: PendingAudioMessage[];
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

interface ToolBlock {
  name: string;
  output?: unknown;
}

function extractTools(content: unknown): ToolBlock[] {
  if (Array.isArray(content)) {
    return (content as Block[])
      .filter((b) => b?.type === "tool_use" || b?.type === "tool_result")
      .map((b) => ({ name: b.name || "?", output: b.output }));
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

function summarizeToolOutput(output: unknown): string {
  if (output == null) return "(sin resultados)";
  if (typeof output === "string") {
    const trimmed = output.trim();
    if (!trimmed || trimmed === "{}" || trimmed === "[]") return "(sin resultados)";
    return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
  }
  if (Array.isArray(output)) {
    return output.length === 0
      ? "(sin resultados)"
      : `${output.length} resultado${output.length === 1 ? "" : "s"}`;
  }
  if (typeof output === "object") {
    const keys = Object.keys(output as Record<string, unknown>);
    if (keys.length === 0) return "(sin resultados)";
    return `${keys.length} campo${keys.length === 1 ? "" : "s"}`;
  }
  return String(output);
}

function AudioBubble({
  url,
  transcribing,
  transcript,
  error,
}: {
  url: string;
  transcribing: boolean;
  transcript: string | null;
  error: string | null;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  return (
    <div className="ml-6 rounded-lg bg-primary/10 px-3 py-2 text-sm">
      <audio controls src={url} className="h-8 w-full" />
      {transcribing && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Transcribiendo…
        </p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">Error: {error}</p>}
      {!transcribing && transcript && (
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {showTranscript ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          {showTranscript ? "Ocultar transcripción" : "Ver transcripción"}
        </button>
      )}
      {showTranscript && transcript && (
        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {transcript}
        </p>
      )}
    </div>
  );
}

export function AnitaMessageList({
  messages,
  liveText,
  isStreaming,
  isThinking,
  pendingUserText,
  pendingAudio,
  liveProposals,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, liveText, liveProposals, pendingUserText, pendingAudio, isThinking]);

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
                <div className="mt-1 space-y-0.5">
                  {tools.map((t, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      <span className="mr-1">🔧 {t.name}</span>
                      {t.output !== undefined && (
                        <span className="text-[11px]">→ {summarizeToolOutput(t.output)}</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {pendingAudio.map((a) => (
          <AudioBubble
            key={a.id}
            url={a.url}
            transcribing={a.transcribing}
            transcript={a.transcript}
            error={a.error}
          />
        ))}

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
