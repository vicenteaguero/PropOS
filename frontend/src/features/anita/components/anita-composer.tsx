import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send, Loader2, ChevronRight } from "lucide-react";
import { useMicrophone } from "@shared/hooks/use-microphone";
import { anitaApi } from "../api/anita-api";

interface Props {
  onSend: (text: string) => void;
  isStreaming: boolean;
  autoSend?: boolean;
  sessionId?: string;
}

/**
 * Audio path: MediaRecorder → POST /anita/transcripts → autosend text.
 *
 * Web Speech API was dropped — mobile OS dictation is free and we want
 * a single codepath that works for upcoming WhatsApp audio messages.
 */
export function AnitaComposer({ onSend, isStreaming, autoSend = true, sessionId }: Props) {
  const [text, setText] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const recorder = useMicrophone();

  // After recording stops: server STT → fill input → autoSend.
  useEffect(() => {
    const blob = recorder.audioBlob;
    if (!blob || !sessionId) return;
    let cancelled = false;
    (async () => {
      setTranscribing(true);
      try {
        const result = await anitaApi.createTranscript(blob, sessionId);
        if (cancelled) return;
        setText(result.text);
        setLastTranscript(result.text);
        setShowTranscript(false);
        if (autoSend && result.text.trim()) {
          setTimeout(() => {
            if (!cancelled && result.text.trim()) {
              onSend(result.text.trim());
              setText("");
            }
          }, 1500);
        }
      } catch (err) {
        if (!cancelled) console.error("transcribe failed", err);
      } finally {
        if (!cancelled) setTranscribing(false);
        recorder.clearRecording();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recorder.audioBlob, autoSend, sessionId, onSend, recorder]);

  const isListening = recorder.isRecording;

  const handleMicClick = () => {
    if (recorder.isRecording) {
      recorder.stopRecording();
    } else {
      setText("");
      void recorder.startRecording();
    }
  };

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="space-y-2">
      {recorder.error && <p className="text-xs text-destructive">{recorder.error}</p>}

      {lastTranscript && !isListening && !transcribing && (
        <details
          open={showTranscript}
          onToggle={(e) => setShowTranscript((e.target as HTMLDetailsElement).open)}
          className="text-xs text-muted-foreground"
        >
          <summary className="cursor-pointer flex items-center gap-1 select-none">
            <ChevronRight className={`size-3 transition-transform ${showTranscript ? "rotate-90" : ""}`} />
            🎙 Transcripción
          </summary>
          <p className="mt-1 pl-4 whitespace-pre-wrap">{lastTranscript}</p>
        </details>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="icon"
          variant={isListening ? "destructive" : "secondary"}
          onClick={handleMicClick}
          disabled={isStreaming || transcribing}
          title="Hablar"
        >
          {isListening ? (
            <MicOff className="size-4" />
          ) : transcribing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            isListening ? "Grabando… toca para parar" : transcribing ? "Transcribiendo…" : "Habla o escribe a Anita…"
          }
          disabled={isStreaming || transcribing}
          className="flex-1"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
        >
          {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      {autoSend && !isListening && text && lastTranscript === text && (
        <p className="text-xs text-muted-foreground">Enviando en 1.5s… toca el input para editar.</p>
      )}
    </div>
  );
}
