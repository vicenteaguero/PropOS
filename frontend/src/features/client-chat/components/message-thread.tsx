import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  MoreVertical,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoundButton, WhatsAppMark, FOCUS_RING } from "@shared/ui";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@shared/hooks/use-keyboard-inset";
import { useImmersive } from "@layouts/immersive";
import { useShellMode } from "@shared/hooks/use-shell-mode";
import { IdentifyBanner } from "./identify-banner";
import { TemplatePicker } from "./template-picker";
import { useConversationMessages, useSendMessage, useTakeover } from "../hooks/use-client-chat";
import type { ClientConversation, ClientMessage, DeliveryStatus } from "../types";
import { dayLabel } from "@shared/utils/relative-time";

interface Props {
  conversation: ClientConversation;
  /**
   * Who this is. Resolved by the caller, which already holds the contacts list
   * the inbox rows are named from — the thread itself only carries a
   * `contact_id`, so on its own it could never show anything but a phone number,
   * and the name the list had just shown vanished on open.
   */
  title?: string | null;
  /** What it is about — a property, a portal, a subject line. */
  subtitle?: string | null;
  /** Mobile back affordance — returns to the conversation list. */
  onBack?: () => void;
}

const TIME = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayKey = (iso: string) => iso.slice(0, 10);

/**
 * Delivery, as WhatsApp draws it. `delivery_status` was printed raw beside a
 * single check, so a sent message read "sent", a read one read "read", and the
 * check meant nothing because it was there either way.
 */
function DeliveryTick({ status }: { status: DeliveryStatus }) {
  if (status === "failed") return <span className="text-destructive">No entregado</span>;
  if (status === "queued") return <Clock className="size-3" strokeWidth={2} />;
  if (status === "read") return <CheckCheck className="size-3.5 text-sky-400" strokeWidth={2.2} />;
  if (status === "delivered") return <CheckCheck className="size-3.5" strokeWidth={2.2} />;
  return <Check className="size-3.5" strokeWidth={2.2} />;
}

export function MessageThread({ conversation, title, subtitle, onBack }: Props) {
  // Keeps the composer on the keyboard instead of behind it.
  useKeyboardInset();
  // `onBack` is only passed by the phone pane, so it doubles as "this thread is
  // the whole screen right now" — which is when the shell's two bars should go.
  useImmersive(!!onBack);
  // The notch inset belongs to whoever is the topmost element on screen. In the
  // phone shell that is this header, because the claim above has unmounted
  // `MobileTopBar`; in the sidebar shell the app's own <header> is already
  // under the notch and adding it again indents this bar a second time.
  const bare = useShellMode() === "bottom-nav";

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

  const who = title || conversation.external_phone_e164 || "(sin número)";
  // The phone number is worth keeping once a name has taken its place — it is
  // what the broker dictates to a notary, and it disappeared entirely when the
  // header started resolving names.
  const context =
    subtitle ||
    conversation.external_phone_e164 ||
    (conversation.ai_enabled ? "Propo responde" : null);

  /** Messages with a separator injected wherever the calendar day changes. */
  const days = useMemo(() => {
    const out: Array<{ day: string; items: ClientMessage[] }> = [];
    for (const m of messages) {
      const key = dayKey(m.created_at);
      const last = out[out.length - 1];
      if (last && last.day === key) last.items.push(m);
      else out.push({ day: key, items: [m] });
    }
    return out;
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* One header row, not three. It used to be a title bar, then a banner,
          then a row of two outline buttons reading "Tomar control" and
          "Cerrar" — 130px of chrome above the first message, on a screen whose
          entire job is showing messages. Both actions are rare and both are
          about the thread rather than about this reply, which is what an
          overflow menu is for. */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-border px-[var(--page-x)] py-2.5",
          bare && "pt-[calc(var(--safe-top)+0.625rem)]",
        )}
      >
        {onBack && (
          <RoundButton
            tone="ghost"
            size={36}
            aria-label="Volver"
            onClick={onBack}
            className="-ml-2"
          >
            <ArrowLeft className="size-5" strokeWidth={1.8} />
          </RoundButton>
        )}
        <WhatsAppMark size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight text-foreground">
            {who}
          </div>
          {context && (
            <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{context}</div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RoundButton tone="ghost" size={36} aria-label="Opciones de la conversación">
              <MoreVertical className="size-5" strokeWidth={1.8} />
            </RoundButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {conversation.ai_enabled ? (
              <DropdownMenuItem onClick={() => takeover.mutate("take")}>
                Tomar control
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => takeover.mutate("release")}>
                Devolver a Propo
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => takeover.mutate("close")}>
              Cerrar conversación
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Before anything else: we do not know who this is. Every other action
          on this thread — consent, linking a property, letting Propo answer —
          depends on there being a person behind the number. */}
      {!conversation.contact_id && <IdentifyBanner conversation={conversation} />}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-[var(--page-x)] py-4">
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {days.map(({ day, items }) => (
          <div key={day}>
            {/* Without these a thread was one undated column: a message from
                March sat directly above one from today with nothing between
                them but a clock time that made it look like minutes. */}
            <div className="flex justify-center py-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground first-letter:uppercase">
                {dayLabel(new Date(items[0]!.created_at))}
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map((m) => {
                const isInbound = m.direction === "inbound";
                const isAi = m.sender_type === "agent_ai";
                return (
                  <div
                    key={m.id}
                    className={cn("flex", isInbound ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] min-w-0 rounded-2xl px-3 py-2 text-[14.5px] leading-snug",
                        isInbound
                          ? "rounded-bl-md bg-secondary text-foreground"
                          : isAi
                            ? "rounded-br-md bg-accent-brand/12 text-foreground"
                            : "rounded-br-md bg-primary text-primary-foreground",
                      )}
                    >
                      {/* `break-words`: a pasted portal link is one token with
                          no break opportunity in it, and `pre-wrap` alone let
                          it run past the bubble and past the screen. */}
                      <div className="overflow-hidden break-words whitespace-pre-wrap">
                        {m.content}
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 flex items-center justify-end gap-1 text-[10.5px] tabular-nums",
                          isInbound || isAi
                            ? "text-muted-foreground"
                            : "text-primary-foreground/75",
                        )}
                      >
                        {isAi && (
                          <span className="inline-flex items-center gap-0.5">
                            <Bot className="size-3" strokeWidth={1.8} /> Propo
                          </span>
                        )}
                        {m.template_name && <span className="truncate">plantilla</span>}
                        <span>{TIME.format(new Date(m.created_at))}</span>
                        {m.direction === "outbound" && <DeliveryTick status={m.delivery_status} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      {/* `shrink-0` so the composer keeps its full height when the thread above
          it is long — as a flex child of a bounded column it was allowed to
          compress, and `min-w-0` on the row below is what stops the `<input>`
          from pushing the send button off the right edge: an input carries an
          intrinsic min-content width (`size` defaults to ~20 characters) and a
          flex item's `min-width:auto` refuses to shrink past it. */}
      <div className="pb-composer shrink-0 border-t border-border bg-background px-[var(--page-x)] pt-2.5">
        {!inWindow && (
          <div className="mb-2 space-y-2">
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
              Pasaron más de 24 h desde su último mensaje. WhatsApp sólo entrega plantillas
              aprobadas hasta que vuelva a escribir.
            </div>
            {/* A closed window used to end here, with a disabled input and no
                way forward. The template IS the way forward. */}
            <TemplatePicker conversationId={conversation.id} />
          </div>
        )}
        <div className="flex w-full min-w-0 items-center gap-2">
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
            placeholder={inWindow ? "Escribe un mensaje…" : "Sólo plantillas (24 h cerrada)"}
            disabled={!inWindow || send.isPending}
            className={`h-11 w-full min-w-0 flex-1 rounded-full border border-border bg-secondary px-4 text-sm text-foreground transition placeholder:text-muted-foreground disabled:opacity-50 ${FOCUS_RING}`}
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
