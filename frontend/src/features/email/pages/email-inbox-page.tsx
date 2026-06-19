import { useState } from "react";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { BrandMark, Pill, type PillTone, RoundButton, Row } from "@shared/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEmailThread, useEmailThreads, useReplyEmail } from "../hooks/use-email";

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
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Escribí tu respuesta…"
          className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-line-strong"
        />
        <RoundButton tone="ink" size={44} aria-label="Enviar" onClick={send} disabled={reply.isPending}>
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

export function EmailInboxPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: threads, isLoading, error, refetch } = useEmailThreads({ status: "OPEN" });
  const { data: thread } = useEmailThread(selected ?? undefined);

  return (
    <PageLayout width="full">
      <PageHeader
        title="Correos"
        description="Leads de portales y conversaciones por email, centralizadas."
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudieron cargar los correos.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {!isLoading && !error && (threads?.length ?? 0) === 0 && (
        <EmptyState
          title="Sin correos"
          description="Cuando se sincronice el buzón, los leads de portales aparecerán acá."
        />
      )}

      {!isLoading && !error && threads && threads.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[340px_1fr]">
          {/* Thread list — hidden on mobile while a thread is open. */}
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-border",
              selected ? "hidden md:block" : "block",
            )}
          >
            {threads.map((t, i) => (
              <Row
                key={t.id}
                divider={i < threads.length - 1}
                onClick={() => setSelected(t.id)}
                className={selected === t.id ? "bg-secondary/60" : undefined}
                left={
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <BrandMark brand="titan" size={26} />
                  </span>
                }
                title={t.counterpart_name || t.counterpart_email || "(sin remitente)"}
                sub={
                  <>
                    <span className="block truncate">{t.subject || "(sin asunto)"}</span>
                    <span className="block text-faint">{fmt(t.last_message_at)}</span>
                  </>
                }
                right={
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Pill tone={statusTone(t.status)}>{statusLabel(t.status)}</Pill>
                    {t.is_lead && t.portal && <Pill tone="accent">{t.portal}</Pill>}
                  </span>
                }
              />
            ))}
          </div>

          {/* Thread detail. On mobile it takes over the full surface. */}
          <div
            className={cn(
              "min-h-[60vh] flex-col rounded-2xl border border-border",
              selected ? "flex" : "hidden md:flex",
            )}
          >
            {!thread ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Mail className="mr-2 size-4" strokeWidth={1.8} /> Seleccioná una conversación
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <RoundButton
                    tone="ghost"
                    size={36}
                    aria-label="Volver"
                    className="md:hidden"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft className="size-5" strokeWidth={1.8} />
                  </RoundButton>
                  <div className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                    {thread.subject || "(sin asunto)"}
                  </div>
                  <Pill tone={statusTone(thread.status)}>{statusLabel(thread.status)}</Pill>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {thread.messages.map((m) => {
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
                  })}
                </div>
                <ReplyBox threadId={thread.id} />
              </>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
