import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface UseWebSpeechReturn {
  isSupported: boolean;
  isListening: boolean;
  interim: string;
  finalText: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Web Speech API browser-native (es-CL). Free, in-browser, low latency.
 * Falls back to MediaRecorder + server transcribe via separate hook.
 */
export function useWebSpeech(lang = "es-CL"): UseWebSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const Ctor =
    typeof window !== "undefined"
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;
  const isSupported = !!Ctor;

  const start = useCallback(() => {
    if (!Ctor) {
      setError("Tu navegador no soporta reconocimiento de voz");
      return;
    }
    setError(null);
    setInterim("");
    setFinalText("");
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interimAcc = "";
      let finalAcc = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalAcc += text;
        } else {
          interimAcc += text;
        }
      }
      if (finalAcc) {
        setFinalText((prev) => (prev + " " + finalAcc).trim());
      }
      setInterim(interimAcc);
    };

    rec.onerror = (event) => {
      setError(event.error || "error de reconocimiento");
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [Ctor, lang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterim("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { isSupported, isListening, interim, finalText, error, start, stop, reset };
}
