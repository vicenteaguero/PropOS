import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { useWebSpeech } from "../hooks/use-web-speech";
import { useMicrophone } from "@shared/hooks/use-microphone";
import { anitaApi } from "../api/anita-api";

interface Props {
  onSend: (text: string) => void;
  isStreaming: boolean;
  autoSend?: boolean;
  sessionId?: string;
}

/**
 * Audio paths persist transcripts to anita_transcripts (forensic record).
 * Plain typing does NOT — keeps the transcripts table clean.
 */
export function AnitaComposer({
  onSend,
  isStreaming,
  autoSend = true,
  sessionId,
}: Props) {
  const [text, setText] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const speech = useWebSpeech("es-CL");
  const recorder = useMicrophone();
  const useFallback = !speech.isSupported;

  useEffect(() => {
    if (useFallback) return;
    if (speech.finalText) {
      setText((speech.finalText + (speech.interim ? " " + speech.interim : "")).trim());
    } else if (speech.interim) {
      setText(speech.interim);
    }
  }, [speech.finalText, speech.interim, useFallback]);

  // Persist transcript + autoSend (browser Web Speech path)
  useEffect(() => {
    if (!autoSend || useFallback) return;
    if (speech.isListening) return;
    if (!speech.finalText.trim()) return;
    const id = setTimeout(async () => {
      const final = speech.finalText.trim();
      if (!final) return;
      // Forensic: persist the audio-derived transcript.
      try {
        await anitaApi.transcribeText(final, sessionId);
      } catch {
        /* non-fatal */
      }
      onSend(final);
      setText("");
      speech.reset();
    }, 2000);
    return () => clearTimeout(id);
  }, [
    speech.isListening,
    speech.finalText,
    autoSend,
    onSend,
    speech,
    useFallback,
    sessionId,
  ]);

  // Fallback path: MediaRecorder → server STT → autoSend
  useEffect(() => {
    if (!useFallback) return;
    const blob = recorder.audioBlob;
    if (!blob) return;
    let cancelled = false;
    (async () => {
      setTranscribing(true);
      try {
        const result = await anitaApi.transcribeAudio(blob, sessionId);
        if (cancelled) return;
        setText(result.text);
        if (autoSend && result.text.trim()) {
          setTimeout(() => {
            if (!cancelled && result.text.trim()) {
              onSend(result.text.trim());
              setText("");
            }
          }, 2000);
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
  }, [useFallback, recorder.audioBlob, autoSend, sessionId, onSend, recorder]);

  const isListening = useFallback ? recorder.isRecording : speech.isListening;

  const handleMicClick = () => {
    if (useFallback) {
      if (recorder.isRecording) {
        recorder.stopRecording();
      } else {
        setText("");
        void recorder.startRecording();
      }
    } else {
      if (speech.isListening) {
        speech.stop();
      } else {
        speech.reset();
        setText("");
        speech.start();
      }
    }
  };

  const handleSend = () => {
    if (!text.trim() || isStreaming) return;
    onSend(text.trim());
    setText("");
    speech.reset();
  };

  const error = speech.error || recorder.error;
  const placeholderText = isListening
    ? useFallback
      ? "Grabando… toca para parar"
      : "Te escucho…"
    : "Habla o escribe a Anita…";

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {useFallback && (
        <p className="text-xs text-muted-foreground">
          Modo grabación (transcripción server). Tu navegador no soporta voz nativa.
        </p>
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
          placeholder={placeholderText}
          disabled={isStreaming || transcribing}
          className="flex-1"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
        >
          {isStreaming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
      {autoSend && !isListening && (speech.finalText || (useFallback && text)) && (
        <p className="text-xs text-muted-foreground">
          Enviando en 2s… toca el input para editar.
        </p>
      )}
    </div>
  );
}
