import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, X, Mic, MessageSquare, PlusCircle, Loader2, ArrowRight } from "lucide-react";
import { useAgentSession, useAgentMessages } from "../hooks/use-agent-session";
import { useAgentChat } from "../hooks/use-agent-chat";
import { agentApi } from "../api/agent-api";
import { AgentComposer } from "./agent-composer";
import { AgentMessageList } from "./agent-message-list";
import { AgentVoice } from "./agent-voice";
import { useAgentName } from "@core/branding/agent-branding";
import { TOUCH_TARGET_HIT_AREA } from "@shared/ui";
import { useDismissOnBack } from "@shared/hooks/use-dismiss-on-back";

interface Props {
  onClose: () => void;
  initialMode?: "voice" | "chat";
}

const SUGGESTIONS = [
  "Resume mis pendientes de hoy",
  "Agéndame una visita el sábado y recuérdame revisar los planos",
  "Redacta una respuesta para un interesado por WhatsApp",
];

/**
 * Full-screen immersive Propo (Claude Design): voice + chat modes sharing one
 * agent session. Mount only when open (lazy session). Full-screen on mobile,
 * centered modal on desktop. Forced-dark subtree so the chat renders correctly
 * regardless of the app theme.
 */
export function AgentOverlay({ onClose, initialMode = "chat" }: Props) {
  // Android Back (and the iOS edge swipe in standalone) closes this, rather
  // than navigating away and discarding whatever was typed.
  useDismissOnBack(true, onClose);
  const sessionQuery = useAgentSession();
  const sessionId = sessionQuery.data?.id;
  const messagesQuery = useAgentMessages(sessionId);
  const chat = useAgentChat(sessionId);
  const agentName = useAgentName();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"voice" | "chat">(initialMode);
  const [closing, setClosing] = useState(false);

  const handleNew = async () => {
    if (!sessionId || closing) return;
    setClosing(true);
    try {
      await agentApi.updateSession(sessionId, { status: "CLOSED" });
    } catch {
      /* force-resume even if close fails */
    }
    chat.reset();
    await qc.invalidateQueries({ queryKey: ["agent", "session"] });
    qc.removeQueries({ queryKey: ["agent", "messages"] });
    setClosing(false);
  };

  const messages = messagesQuery.data ?? [];
  const showSuggestions =
    mode === "chat" &&
    messages.length === 0 &&
    !chat.isStreaming &&
    !chat.pendingUserText &&
    chat.pendingAudio.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:bg-black/40">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 hidden cursor-default md:block"
      />
      {/* Mobile: full-screen. Desktop: docked right-hand panel (slide-over). */}
      <div className="dark relative flex h-full w-full flex-col overflow-hidden bg-[#0A0A0A] text-white duration-300 animate-in fade-in max-md:slide-in-from-bottom-4 md:w-[26rem] md:slide-in-from-right md:border-l md:border-white/10 md:shadow-2xl">
        {/* header */}
        <div
          className={`flex shrink-0 items-center justify-between px-4 pt-[calc(var(--safe-top)+1rem)] pl-[calc(var(--safe-left)+1rem)] pr-[calc(var(--safe-right)+1rem)] pb-3 md:pt-4 ${
            mode === "chat" ? "border-b border-white/10" : ""
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-white">
              <Sparkles className="size-5 text-black" />
            </span>
            <div>
              <div className="text-[16px] font-bold leading-none">{agentName}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-white/50">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {mode === "voice" ? "Modo voz" : "Asistente IA"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "chat" && (
              <button
                type="button"
                onClick={handleNew}
                disabled={!sessionId || closing || chat.isStreaming}
                aria-label="Nueva conversación"
                className={`flex size-9 items-center justify-center rounded-full bg-white/10 transition active:scale-90 disabled:opacity-40 ${TOUCH_TARGET_HIT_AREA}`}
              >
                {closing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PlusCircle className="size-[18px]" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode((m) => (m === "voice" ? "chat" : "voice"))}
              aria-label={mode === "voice" ? "Cambiar a chat" : "Cambiar a voz"}
              className={`flex size-9 items-center justify-center rounded-full bg-white/10 transition active:scale-90 ${TOUCH_TARGET_HIT_AREA}`}
            >
              {mode === "voice" ? (
                <MessageSquare className="size-[18px]" />
              ) : (
                <Mic className="size-[18px]" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className={`flex h-9 items-center justify-center gap-1.5 rounded-full bg-white/20 px-3.5 transition hover:bg-white/30 active:scale-90 md:size-9 md:px-0 ${TOUCH_TARGET_HIT_AREA}`}
            >
              <X className="size-5 md:size-[18px]" strokeWidth={2.2} />
              <span className="text-sm font-semibold md:hidden">Cerrar</span>
            </button>
          </div>
        </div>

        {/* body */}
        {sessionQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-white/50" />
          </div>
        ) : sessionQuery.isError ? (
          <p className="p-6 text-center text-sm text-red-400">
            No pude abrir tu sesión. Recarga e intenta de nuevo.
          </p>
        ) : mode === "voice" ? (
          <AgentVoice chat={chat} onSwitchToChat={() => setMode("chat")} onClose={onClose} />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-hidden px-4">
              {showSuggestions ? (
                <div className="flex h-full flex-col justify-end gap-2 pb-2">
                  <p className="px-1 pb-1 text-[14px] text-white/60">
                    Hola 👋 Soy {agentName}. Dime qué necesitas o prueba con:
                  </p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => chat.send(s)}
                      className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3 text-left text-[13.5px] text-white transition active:scale-[0.99]"
                    >
                      <Sparkles className="size-4 shrink-0 text-white/60" />
                      <span className="flex-1">{s}</span>
                      <ArrowRight className="size-4 shrink-0 text-white/40" />
                    </button>
                  ))}
                </div>
              ) : (
                <AgentMessageList
                  messages={messages}
                  liveText={chat.liveText}
                  isStreaming={chat.isStreaming}
                  isThinking={chat.isThinking}
                  pendingUserText={chat.pendingUserText}
                  pendingAudio={chat.pendingAudio}
                  liveProposals={chat.proposalsCreated}
                />
              )}
            </div>
            {chat.error && <p className="px-4 text-xs text-red-400">{chat.error}</p>}
            <div className="shrink-0 border-t border-white/10 p-3 pb-[calc(var(--safe-bottom)+0.75rem)]">
              <AgentComposer
                onSend={chat.send}
                onAudio={chat.submitAudio}
                isStreaming={chat.isStreaming}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
