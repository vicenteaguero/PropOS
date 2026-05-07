import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Square, Send, Loader2 } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  onAudio: (blob: Blob, url: string) => void;
  isStreaming: boolean;
}

/**
 * Audio path: MediaRecorder → onAudio(blob, url). The chat hook posts
 * the audio bubble as a user message immediately and runs server STT
 * in the background.
 *
 * While recording we render a live AnalyserNode-backed waveform on a
 * canvas so the user can see input is being captured.
 */
export function AnitaComposer({ onSend, onAudio, isStreaming }: Props) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>("audio/webm");

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => () => cleanup(), []);

  const drawWaveform = () => {
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
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      const bars = 32;
      const step = Math.floor(bufferLength / bars);
      const barWidth = w / bars;
      const gap = 2;
      ctx.fillStyle = "rgb(99, 102, 241)";
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        const avg = sum / step / 255;
        const barH = Math.max(2, avg * h);
        const x = i * barWidth + gap / 2;
        const y = (h - barH) / 2;
        ctx.fillRect(x, y, barWidth - gap, barH);
      }
      rafRef.current = requestAnimationFrame(render);
    };
    render();
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      mimeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        const url = URL.createObjectURL(blob);
        cleanup();
        setRecording(false);
        setDuration(0);
        onAudio(blob, url);
      };

      // AudioContext for waveform
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      recorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      drawWaveform();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
  };

  const handleMicClick = () => {
    if (recording) stopRecording();
    else void startRecording();
  };

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;
    onSend(text.trim());
    setText("");
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-destructive">{error}</p>}

      {recording ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <span className="size-2 animate-pulse rounded-full bg-destructive" />
          <canvas ref={canvasRef} className="h-8 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{fmt(duration)}</span>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={stopRecording}
            title="Parar grabación"
          >
            <Square className="size-4 fill-current" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Habla o escribe a Anita…"
            disabled={isStreaming}
            className="flex-1"
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={handleMicClick}
            disabled={isStreaming}
            title="Hablar"
          >
            <Mic className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || isStreaming}
            title="Enviar"
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
