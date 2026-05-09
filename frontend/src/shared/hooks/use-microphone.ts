import { useState, useRef, useCallback } from "react";

interface UseMicrophoneReturn {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearRecording: () => void;
}

export function useMicrophone(): UseMicrophoneReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setDuration(0);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Tu navegador no soporta micrófono. En iOS, abrí PropOS desde la pantalla de inicio (PWA instalada).",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const isIos = /iPad|iPhone|iPod/.test(ua);
      let message = "No se pudo acceder al micrófono.";
      if (name === "NotAllowedError" || name === "SecurityError") {
        message = isIos
          ? "Permiso de micrófono denegado. Abrí Ajustes → Safari (o PropOS si está instalada) → Micrófono → Permitir."
          : "Permiso de micrófono denegado. Habilitalo en la configuración del navegador y volvé a intentar.";
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        message = "No se encontró ningún micrófono en este dispositivo.";
      } else if (err instanceof Error && err.message) {
        message = err.message;
      }
      setError(message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const clearRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  }, [audioUrl]);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    duration,
    error,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
