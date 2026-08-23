import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Mic, MessageSquare, PlusCircle, Loader2, ArrowRight } from "lucide-react";
import { PropoMark } from "@shared/ui";
import { useAgentSession, useAgentMessages } from "../hooks/use-agent-session";
import { useAgentChat } from "../hooks/use-agent-chat";
import { agentApi } from "../api/agent-api";
import { AgentComposer } from "./agent-composer";
import { AgentMessageList } from "./agent-message-list";
import { AgentVoice } from "./agent-voice";
import { useAgentName } from "@core/branding/agent-branding";
import { useFeature } from "@shared/feature/use-feature";
import { TOUCH_TARGET_HIT_AREA } from "@shared/ui";
import { useDismissOnBack } from "@shared/hooks/use-dismiss-on-back";
import { useKeyboardInset } from "@shared/hooks/use-keyboard-inset";
import { useScrollLock } from "@shared/hooks/use-scroll-lock";
import { overrideThemeColor } from "@core/theme/theme";

interface Props {
  onClose: () => void;
  initialMode?: "voice" | "chat";
}

/**
 * The panel's own background, for the window chrome.
 *
 * It used to be a hardcoded `#0A0A0A`, which is not any colour PropOS actually
 * uses: the app's dark background is `#0c0e12` tinted with the workspace hue,
 * so the panel sat as a visibly cooler black against it and the seam showed
 * wherever the two met. The panel now paints `bg-background` inside its own
 * forced-dark subtree, which picks up the tenant tint for free.
 *
 * The one consumer that needs a real string is `theme-color`, which cannot take
 * a `color-mix()`. So it is read off the rendered element instead of being
 * duplicated here — one source of truth, and it cannot drift again.
 */
function useChromeColor(el: HTMLElement | null): void {
  useEffect(() => {
    if (!el) return;
    const colour = getComputedStyle(el).backgroundColor;
    if (!colour) return;
    overrideThemeColor(colour);
    // The root canvas, too. Everything above is a covering layer, and a
    // covering layer can only be as correct as its geometry; the root is what
    // the compositor shows wherever no box happens to land — including the
    // strip iOS opens between the visible viewport and the keyboard.
    const root = document.documentElement;
    const previous = root.style.backgroundColor;
    root.style.backgroundColor = colour;
    return () => {
      overrideThemeColor(null);
      root.style.backgroundColor = previous;
    };
  }, [el]);
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
  // Keeps the composer above the on-screen keyboard instead of behind it, and
  // pins this panel to the visible box rather than the layout viewport.
  const keyboard = useKeyboardInset();
  // The overlay is a bare portal, not a Radix dialog: nothing else stops the
  // page behind it from scrolling.
  useScrollLock(true);
  // The panel forces its own dark palette, so the PWA's status bar and bottom
  // safe area have to follow it — otherwise a light-theme broker gets a white
  // band above and below a black panel.
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  useChromeColor(panel);
  const sessionQuery = useAgentSession();
  const sessionId = sessionQuery.data?.id;
  const messagesQuery = useAgentMessages(sessionId);
  const chat = useAgentChat(sessionId);
  const agentName = useAgentName();
  const agentWip = useFeature("agent").showWip;
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
  // Hidden the moment there is a keyboard. Three example prompts are useful on
  // an empty chat and useless once the broker is typing — and on a phone the
  // keyboard leaves ~300px, which the suggestions were pushing the composer out
  // of. They come back when the keyboard goes.
  const showSuggestions =
    mode === "chat" &&
    !keyboard.open &&
    messages.length === 0 &&
    !chat.isStreaming &&
    !chat.pendingUserText &&
    chat.pendingAudio.length === 0;

  return (
    <>
      {/* Two layers, and both are load-bearing.
          
          This one spans the LAYOUT viewport and never resizes. iOS does not
          shrink the layout viewport for the keyboard, and `visualViewport`
          events fire all through the keyboard's opening animation — so a panel
          sized to the visual viewport shrinks *ahead of* the keys and exposes
          whatever is mounted behind it. That was the broker seeing their own
          Inicio page under the keyboard. An opaque layer that never moves means
          there is nothing to see through at any frame of the animation.
          
          Opaque on a phone, the usual scrim on a laptop, where there is no
          keyboard and the page behind is meant to show. */}
      {/* Oversized by half a viewport in each direction, and deliberately NOT
          pinned to `--vv-*`. It must not follow the visible box — a backdrop
          that shrinks with the keyboard exposes the page behind mid-animation —
          but `inset-0` alone is not enough either, because iOS rubber-band
          overscroll can lift the layout viewport's edge above the visible one
          and leave an uncovered strip. Extending past both edges is correct
          before the store's first write, correct without `visualViewport`, and
          correct at every frame of the animation.

          Sized in `lvh`, not in percentages. A percentage resolves against the
          initial containing block, and in an installed iOS PWA the keyboard
          resizes that block — so `-top-1/2/-bottom-1/2` shrank along with the
          page and stopped covering the strip the keyboard was about to occupy.
          `lvh` is the LARGE viewport: fixed to the window at its tallest, never
          moved by the keyboard or by browser chrome, which is the only unit
          here that means what this element needs it to mean. */}
      <div
        aria-hidden
        // `dark` on this element, not only on the panel: the class defines the
        // palette custom properties on whatever carries it, so `bg-background`
        // right here resolves to the app's dark background even when the broker
        // is in light mode.
        className="dark fixed inset-x-0 top-[-50lvh] z-50 h-[200lvh] bg-background md:bg-overlay/50 md:backdrop-blur-md"
      />
      {/* And this one is pinned to the VISIBLE box, so the header and the
          composer stay where the eye is instead of scrolling off the top when
          Safari scrolls the visual viewport under a focused input. */}
      <div className="fixed-vv z-50 flex justify-end">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute inset-0 hidden cursor-default md:block"
        />
        {/* Mobile: full-screen. Desktop: docked right-hand panel (slide-over). */}
        <div
          ref={setPanel}
          className="dark relative flex h-full w-full flex-col overflow-hidden bg-background text-white duration-300 animate-in fade-in max-md:slide-in-from-bottom-4 md:w-[26rem] md:slide-in-from-right md:border-l md:border-white/10 md:shadow-2xl"
        >
          {/* header */}
          <div
            className={`flex shrink-0 items-center justify-between px-4 pt-[calc(var(--safe-top)+1rem)] pl-[calc(var(--safe-left)+1rem)] pr-[calc(var(--safe-right)+1rem)] pb-3 md:pt-4 ${
              mode === "chat" ? "border-b border-white/10" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              {/* The mark's own state: it plays its opening flourish once when
                  the overlay mounts, then accelerates for as long as Propo is
                  actually working. That is the whole reason it animates. */}
              <span className="flex size-9 items-center justify-center rounded-full bg-white">
                <PropoMark
                  state={chat.isThinking ? "thinking" : "open"}
                  className="size-5 text-black"
                />
              </span>
              <div>
                <div className="text-[16px] font-bold leading-none">{agentName}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-white/50">
                  {/* The status line is the only place in the overlay with room
                      to say it, and it is on screen for the whole session. The
                      sentence itself is one tap away on the Propo page. */}
                  <span
                    className={`size-1.5 rounded-full ${agentWip ? "bg-warning" : "bg-emerald-500"}`}
                  />
                  {agentWip ? "En desarrollo" : mode === "voice" ? "Modo voz" : "Asistente IA"}
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
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => chat.send(s)}
                        className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-left text-[13.5px] text-white transition active:scale-[0.99]"
                      >
                        <PropoMark className="size-4 shrink-0 text-white/60" />
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
              {/* `.pb-composer-vv`, not `.pb-composer`: this panel is pinned to
                the visual viewport, so the keyboard is already outside its box
                and adding --kb-inset again would float the composer a keyboard's
                height above the keys. */}
              <div className="pb-composer-vv shrink-0 border-t border-white/10 p-3">
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
    </>
  );
}
