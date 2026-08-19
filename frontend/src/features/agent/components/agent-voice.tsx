import { useEffect, useRef, useState } from "react";
import { Check, Mic, MessageSquare } from "lucide-react";
import { AgentInlineProposalCard } from "./agent-inline-proposal-card";
import type { useAgentChat } from "../hooks/use-agent-chat";
import { acquireMicStream, releaseMicStream } from "@shared/lib/mic-stream";

type Chat = ReturnType<typeof useAgentChat>;

interface Props {
  chat: Chat;
  onSwitchToChat: () => void;
  onClose: () => void;
}

type Phase = "idle" | "listening" | "thinking" | "done";

/**
 * Immersive Propo voice mode (Claude Design). Real pipeline:
 *   tap mic → record (live waveform) → stop → submitAudio (server STT) →
 *   transcript shows as "Tú dijiste" → SSE reply streams → proposals render.
 * Derives its phase from the shared useAgentChat state + local recording.
 */
export function AgentVoice({ chat, onSwitchToChat, onClose }: Props) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mimeRef = useRef<string>("audio/webm");

  // keep the streamed reply visible after the hook clears liveText
  useEffect(() => {
    if (chat.liveText) setReply(chat.liveText);
  }, [chat.liveText]);

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    releaseMicStream();
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  };
  useEffect(() => () => cleanup(), []);

  const draw = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }
    const len = analyser.frequencyBinCount;
    const data = new Uint8Array(len);
    const render = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      const bars = 28;
      const step = Math.floor(len / bars);
      const bw = w / bars;
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        const avg = sum / step / 255;
        const barH = Math.max(3, avg * h);
        const x = i * bw + 2;
        const y = (h - barH) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, bw - 4, barH, 2);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(render);
    };
    render();
  };

  const start = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Tu navegador no soporta micrófono. Instala PropOS como app.");
      }
      const stream = await acquireMicStream();
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      mimeRef.current = mime;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        const url = URL.createObjectURL(blob);
        cleanup();
        setRecording(false);
        setReply("");
        void chat.submitAudio(blob, url);
      };
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyserRef.current = analyser;
      rec.start();
      setRecording(true);
      draw();
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Permiso de micrófono denegado. Habilítalo en ajustes."
          : err instanceof Error
            ? err.message
            : "No se pudo acceder al micrófono.",
      );
    }
  };

  const stop = () => {
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
  };

  // Auto-start listening ~1s after entering voice mode: a brief "warming up"
  // beat (pulsing mic) so it feels intentional rather than grabbing the mic the
  // instant the overlay opens. Skipped when resuming an in-flight conversation.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    if (chat.pendingAudio.length > 0 || chat.isStreaming) return;
    autoStarted.current = true;
    const id = setTimeout(() => void start(), 1000);
    return () => clearTimeout(id);
    // Deliberate narrow deps: `start` is recreated every render; the autoStarted ref already makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.pendingAudio.length, chat.isStreaming]);

  const lastAudio = chat.pendingAudio[chat.pendingAudio.length - 1];
  const transcript = lastAudio?.transcript ?? "";
  const transcribing = !!lastAudio?.transcribing;

  const phase: Phase = recording
    ? "listening"
    : transcribing || chat.isThinking || chat.isStreaming
      ? "thinking"
      : reply || chat.proposalsCreated.length
        ? "done"
        : "idle";

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 text-white">
      {/* top region: prompt / transcript */}
      <div
        className={
          phase === "done"
            ? "flex flex-col pt-6 pb-3"
            : "flex flex-1 flex-col justify-center pt-6 pb-3"
        }
      >
        {phase === "idle" && (
          <div className="text-center">
            <h2 className="text-[26px] font-bold tracking-tight">Te escucho…</h2>
            <p className="mt-2.5 text-[15px] text-white/50">Habla con naturalidad.</p>
          </div>
        )}
        {phase !== "idle" && (transcript || phase === "listening") && (
          <div>
            <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.06em] text-white/40">
              {phase === "listening" ? "Escuchando…" : "Tú dijiste"}
            </div>
            <div className="text-[21px] font-semibold leading-snug tracking-tight">
              {transcript}
              {(transcribing || (recording && !transcript)) && (
                <span className="caret text-white/70">&nbsp;</span>
              )}
            </div>
          </div>
        )}
        {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
      </div>

      {/* thinking / done results */}
      {(phase === "thinking" || phase === "done") && (
        <div className="min-h-0 flex-1 overflow-y-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {phase === "thinking" && (
            <div className="flex items-center gap-2.5 py-3 text-[15px] text-white/60">
              <span className="flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:-0.2s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:-0.1s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-white/70" />
              </span>
              Propo está organizando todo…
            </div>
          )}
          {phase === "done" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {reply && <p className="mb-3 text-[15px] leading-relaxed text-white/90">{reply}</p>}
              {chat.proposalsCreated.length > 0 && (
                <div className="space-y-2">
                  {chat.proposalsCreated.map((id) => (
                    <AgentInlineProposalCard key={id} proposalId={id} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* bottom controls */}
      <div className="flex shrink-0 flex-col items-center gap-3.5 pt-1.5 pb-[calc(var(--safe-bottom)+1.5rem)]">
        {phase === "listening" && <canvas ref={canvasRef} className="h-10 w-full max-w-xs" />}
        {(phase === "idle" || phase === "thinking") && (
          <button
            type="button"
            onClick={phase === "idle" ? start : undefined}
            aria-label="Hablar"
            className={`flex size-[74px] items-center justify-center rounded-full bg-white text-black transition active:scale-95 ${
              phase === "idle" ? "micpulse" : ""
            }`}
          >
            <Mic className="size-7" strokeWidth={1.9} />
          </button>
        )}

        {phase === "done" ? (
          <div className="flex w-full gap-2.5">
            <button
              type="button"
              onClick={onSwitchToChat}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/25 py-4 text-[15px] font-semibold text-white transition active:scale-[0.98]"
            >
              <MessageSquare className="size-[18px]" strokeWidth={2} />
              Seguir en chat
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-bold text-black transition active:scale-[0.98]"
            >
              <Check className="size-[18px]" strokeWidth={2.4} />
              Listo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={recording ? stop : phase === "idle" ? start : undefined}
            className="text-[13px] text-white/50"
          >
            {phase === "listening"
              ? "Escuchando · toca para detener"
              : phase === "thinking"
                ? ""
                : "Toca para hablar"}
          </button>
        )}
      </div>
    </div>
  );
}
