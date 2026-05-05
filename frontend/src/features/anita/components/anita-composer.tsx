import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Square, Send, Loader2, X } from "lucide-react";
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
 * Audio playback shows as soon as recording stops; transcription runs
 * in background so the user isn't blocked.
 */
export function AnitaComposer({ onSend, isStreaming, autoSend = true, sessionId }: Props) {
  const [text, setText] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const recorder = useMicrophone();

  // After recording stops: server STT → fill input → autoSend.
  useEffect(() => {
    const blob = recorder.audioBlob;
    if (!blob || !sessionId) return;
    let cancelled = false;
    (async () => {
      setTranscribing(true);
      setTranscribeError(null);
      try {
        const result = await anitaApi.createTranscript(blob, sessionId);
        if (cancelled) return;
        setText(result.text);
        if (autoSend && result.text.trim()) {
          setTimeout(() => {
            if (!cancelled && result.text.trim()) {
              onSend(result.text.trim());
              setText("");
              recorder.clearRecording();
            }
          }, 1500);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "transcripción falló";
          setTranscribeError(msg);
        }
      } finally {
        if (!cancelled) setTranscribing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recorder.audioBlob, autoSend, sessionId, onSend, recorder]);

  const isListening = recorder.isRecording;
  const hasAudio = !!recorder.audioUrl && !isListening;

  const handleMicClick = () => {
    if (recorder.isRecording) {
      recorder.stopRecording();
    } else {
      setText("");
      setTranscribeError(null);
      recorder.clearRecording();
      void recorder.startRecording();
    }
  };

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;
    onSend(text.trim());
    setText("");
    recorder.clearRecording();
  };

  const discardAudio = () => {
    recorder.clearRecording();
    setTranscribeError(null);
    setText("");
  };

  return (
    <div className="space-y-2">
      {recorder.error && <p className="text-xs text-destructive">{recorder.error}</p>}
      {transcribeError && <p className="text-xs text-destructive">Error: {transcribeError}</p>}

      {hasAudio && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1">
          <audio controls src={recorder.audioUrl ?? undefined} className="h-8 flex-1" />
          {transcribing && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Transcribiendo…
            </span>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={discardAudio}
            title="Descartar audio"
            className="size-7"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

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
          placeholder={
            isListening
              ? "Grabando… toca cuadrado para parar"
              : transcribing
                ? "Transcribiendo… puedes editar el texto"
                : "Habla o escribe a Anita…"
          }
          disabled={isStreaming || isListening}
          className="flex-1"
        />
        <Button
          type="button"
          size="icon"
          variant={isListening ? "destructive" : "secondary"}
          onClick={handleMicClick}
          disabled={isStreaming}
          title={isListening ? "Parar grabación" : "Hablar"}
        >
          {isListening ? <Square className="size-4 fill-current" /> : <Mic className="size-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || isStreaming || isListening}
          title="Enviar"
        >
          {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
