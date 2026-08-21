import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Check, Loader2, Send, UserCog } from "lucide-react";
import { BrandMark, Pill, RoundButton, FOCUS_RING } from "@shared/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@shared/hooks/use-keyboard-inset";
import { IdentifyBanner } from "./identify-banner";
import { useConversationMessages, useSendMessage, useTakeover } from "../hooks/use-client-chat";
import type { ClientConversation } from "../types";

interface Props {
  conversation: ClientConversation;
  /** Mobile back affordance — returns to the conversation list. */
  onBack?: () => void;
}

export function MessageThread({ conversation, onBack }: Props) {
  // Keeps the composer on the keyboard instead of behind it.
  useKeyboardInset();
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
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
          <BrandMark brand="whatsapp" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold leading-tight text-foreground">
            {conversation.external_phone_e164 ?? "(sin número)"}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
            IA {conversation.ai_enabled ? "activa" : "en pausa"}
          </div>
        </div>
        <Pill tone={conversation.ai_enabled ? "success" : "neutral"}>
          {conversation.ai_enabled ? "Abierta" : "Manual"}
        </Pill>
      </div>

      {/* Before anything else: we do not know who this is. Every other action
          on this thread — consent, linking a property, letting Propo answer —
          depends on there being a person behind the number. */}
      {!conversation.contact_id && <IdentifyBanner conversation={conversation} />}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2.5">
        {conversation.ai_enabled ? (
          <Button size="sm" variant="outline" onClick={() => takeover.mutate("take")}>
            <UserCog className="size-4" strokeWidth={1.8} />
            Tomar control
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => takeover.mutate("release")}>
            <Bot className="size-4" strokeWidth={1.8} />
            Devolver a IA
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => takeover.mutate("close")}>
          Cerrar
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages.map((m) => {
          const isInbound = m.direction === "inbound";
          const isAi = m.sender_type === "agent_ai";
          return (
            <div key={m.id} className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-xl px-3.5 py-2 text-sm",
                  isInbound
                    ? "bg-secondary text-foreground"
                    : isAi
                      ? "bg-accent-brand/12 text-foreground"
                      : "bg-primary text-primary-foreground",
                )}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-[11px]",
                    isInbound || isAi ? "text-muted-foreground" : "text-primary-foreground/70",
                  )}
                >
                  {isAi && (
                    <span className="inline-flex items-center gap-0.5">
                      <Bot className="size-3" strokeWidth={1.8} /> IA
                    </span>
                  )}
                  {m.template_name && <span>tpl: {m.template_name}</span>}
                  <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                  {m.direction === "outbound" && (
                    <span className="inline-flex items-center gap-0.5">
                      <Check className="size-3" strokeWidth={2} />
                      {m.delivery_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="pb-composer border-t border-border px-4 py-3">
        {!inWindow && (
          <div className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            Fuera de la ventana de 24h — sólo plantillas aprobadas hasta nueva respuesta del
            cliente.
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            aria-label="Mensaje"
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
            className={`h-11 flex-1 rounded-full border border-border bg-secondary px-4 text-sm text-foreground transition placeholder:text-muted-foreground disabled:opacity-50 ${FOCUS_RING}`}
          />
          <RoundButton
            tone="ink"
            size={44}
            aria-label="Enviar"
            onClick={handleSend}
            disabled={!inWindow || !text.trim() || send.isPending}
          >
            {send.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Send className="size-5" strokeWidth={1.8} />
            )}
          </RoundButton>
        </div>
        {send.isError && <div className="mt-2 text-xs text-destructive">{String(send.error)}</div>}
      </div>
    </div>
  );
}
