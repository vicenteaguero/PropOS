import { useState } from "react";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone, RoundButton, FOCUS_RING } from "@shared/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEmailThread, useReplyEmail } from "../hooks/use-email";

function fmt(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function statusTone(status: string): PillTone {
  return status.toUpperCase() === "OPEN" ? "success" : "neutral";
}

function statusLabel(status: string): string {
  return status.toUpperCase() === "OPEN" ? "Abierta" : "Cerrada";
}

function ReplyBox({ threadId }: { threadId: string }) {
  const reply = useReplyEmail(threadId);
  const [body, setBody] = useState("");
  const send = async () => {
    if (!body.trim()) return;
    await reply.mutateAsync(body.trim());
    setBody("");
    toast.success("Respuesta enviada");
  };
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2">
        <textarea
          aria-label="Respuesta"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Escribí tu respuesta…"
          className={`max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground transition placeholder:text-muted-foreground ${FOCUS_RING}`}
        />
        <RoundButton
          tone="ink"
          size={44}
          aria-label="Enviar"
          onClick={send}
          disabled={reply.isPending}
        >
          {reply.isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send className="size-5" strokeWidth={1.8} />
          )}
        </RoundButton>
      </div>
    </div>
  );
}

interface Props {
  threadId: string;
  /** Mobile back affordance — returns to the thread list. */
  onBack?: () => void;
}

/**
 * Self-contained email thread pane. Owns its own fetch and loading / error-retry
 * states so a failed or in-flight selection no longer falls through to the
 * "select a conversation" placeholder (the previous bug).
 */
export function EmailThreadView({ threadId, onBack }: Props) {
  const { data: thread, isLoading, error, refetch } = useEmailThread(threadId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">No se pudo cargar la conversación.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {onBack && (
          <RoundButton
            tone="ghost"
            size={36}
            aria-label="Volver"
            onClick={onBack}
            className="lg:hidden"
          >
            <ArrowLeft className="size-5" strokeWidth={1.8} />
          </RoundButton>
        )}
        <div className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          {thread.subject || "(sin asunto)"}
        </div>
        <Pill tone={statusTone(thread.status)}>{statusLabel(thread.status)}</Pill>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {thread.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Mail className="mr-2 size-4" strokeWidth={1.8} /> Sin mensajes en esta conversación.
          </div>
        ) : (
          thread.messages.map((m) => {
            const isOut = m.direction === "OUT";
            return (
              <div key={m.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                    isOut ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 flex items-center justify-between gap-3 text-[11px]",
                      isOut ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    <span className="truncate font-medium">
                      {isOut ? "Yo" : m.from_name || m.from_email}
                    </span>
                    <span className="shrink-0">{fmt(m.sent_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.body_text || m.snippet}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ReplyBox threadId={thread.id} />
    </div>
  );
}
