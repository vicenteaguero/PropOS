import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import {
  useConversationMessages,
  useSendMessage,
  useTakeover,
} from "../hooks/use-client-chat";
import type { ClientConversation } from "../types";

interface Props {
  conversation: ClientConversation;
}

export function MessageThread({ conversation }: Props) {
  const { data: messages = [], isLoading } = useConversationMessages(conversation.id);
  const send = useSendMessage(conversation.id);
  const takeover = useTakeover(conversation.id);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    send.mutate(t, { onSuccess: () => setText("") });
  };

  const inWindow =
    conversation.last_inbound_at &&
    Date.now() - new Date(conversation.last_inbound_at).getTime() < 24 * 3600 * 1000;

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <div className="text-sm font-semibold">
            {conversation.external_phone_e164 ?? "(sin número)"}
          </div>
          <div className="text-xs text-muted-foreground">
            {conversation.status} · IA {conversation.ai_enabled ? "on" : "off"}
          </div>
        </div>
        <div className="flex gap-2">
          {conversation.ai_enabled ? (
            <Button size="sm" variant="outline" onClick={() => takeover.mutate("take")}>
              Tomar control
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => takeover.mutate("release")}>
              Devolver a IA
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => takeover.mutate("close")}>
            Cerrar
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading && (
          <div className="flex justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.direction === "inbound" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                m.direction === "inbound"
                  ? "bg-muted"
                  : m.sender_type === "agent_ai"
                    ? "bg-primary/10 text-foreground"
                    : "bg-primary text-primary-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                {m.sender_type === "agent_ai" && <span>IA</span>}
                {m.template_name && <span>tpl: {m.template_name}</span>}
                <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                {m.direction === "outbound" && <span>· {m.delivery_status}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3">
        {!inWindow && (
          <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            Fuera de la ventana de 24h — sólo plantillas aprobadas hasta nueva respuesta del cliente.
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={inWindow ? "Escribe un mensaje..." : "Sólo plantillas (24h cerrada)"}
            disabled={!inWindow || send.isPending}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button onClick={handleSend} disabled={!inWindow || !text.trim() || send.isPending}>
            <Send className="size-4" />
          </Button>
        </div>
        {send.isError && (
          <div className="mt-2 text-xs text-destructive">{String(send.error)}</div>
        )}
      </div>
    </Card>
  );
}
