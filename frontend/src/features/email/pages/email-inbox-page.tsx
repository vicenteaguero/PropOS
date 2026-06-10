import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { toast } from "sonner";
import { useEmailThread, useEmailThreads, useReplyEmail } from "../hooks/use-email";

function fmt(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
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
    <div className="border-t p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Escribí tu respuesta…"
      />
      <div className="mt-2 flex justify-end">
        <Button onClick={send} disabled={reply.isPending} className="gap-2">
          {reply.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar
        </Button>
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
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
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
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <div className="divide-y overflow-hidden rounded-lg border">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`block w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                  selected === t.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {t.counterpart_name || t.counterpart_email}
                  </span>
                  {t.is_lead && t.portal && (
                    <Badge variant="outline" className="shrink-0 text-[9px]">
                      {t.portal}
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {t.subject || "(sin asunto)"}
                </div>
                <div className="text-[10px] text-muted-foreground">{fmt(t.last_message_at)}</div>
              </button>
            ))}
          </div>

          <div className="flex min-h-[60vh] flex-col rounded-lg border">
            {!thread ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Mail className="mr-2 size-4" /> Seleccioná una conversación
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  <div className="text-sm font-semibold">{thread.subject}</div>
                  {thread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-md border p-2.5 text-sm ${
                        m.direction === "OUT" ? "ml-8 bg-primary/5" : "mr-8"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{m.direction === "OUT" ? "Yo" : m.from_name || m.from_email}</span>
                        <span>{fmt(m.sent_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{m.body_text || m.snippet}</p>
                    </div>
                  ))}
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
