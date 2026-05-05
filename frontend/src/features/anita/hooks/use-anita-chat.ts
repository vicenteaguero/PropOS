import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamMessage } from "../api/anita-api";
import type { ChatStreamEvent } from "../types";

interface AnitaChatState {
  isStreaming: boolean;
  isThinking: boolean;
  pendingUserText: string | null;
  liveText: string;
  toolEvents: { name: string; args: Record<string, unknown> }[];
  proposalsCreated: string[];
  error: string | null;
}

const INITIAL: AnitaChatState = {
  isStreaming: false,
  isThinking: false,
  pendingUserText: null,
  liveText: "",
  toolEvents: [],
  proposalsCreated: [],
  error: null,
};

/**
 * Drives one chat turn over SSE.
 * The composer is responsible for persisting transcripts (audio path);
 * this hook does NOT touch /transcribe-text — keeps anita_transcripts
 * clean (only real audio sources land there).
 */
export function useAnitaChat(sessionId: string | undefined) {
  const [state, setState] = useState<AnitaChatState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const send = useCallback(
    async (userText: string) => {
      if (!sessionId || !userText.trim()) return;

      // Show user's message immediately, but defer "thinking" indicator
      // ~400ms — first SSE event usually arrives faster than that.
      setState({
        ...INITIAL,
        isStreaming: true,
        isThinking: false,
        pendingUserText: userText,
      });
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = setTimeout(() => {
        setState((s) => (s.isStreaming && !s.liveText ? { ...s, isThinking: true } : s));
      }, 400);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamMessage(
          sessionId,
          { user_text: userText },
          (event: ChatStreamEvent) => {
            if (thinkingTimerRef.current) {
              clearTimeout(thinkingTimerRef.current);
              thinkingTimerRef.current = null;
            }
            if (event.type === "text") {
              setState((s) => ({
                ...s,
                isThinking: false,
                liveText: s.liveText + event.text,
              }));
            } else if (event.type === "tool_use") {
              setState((s) => ({
                ...s,
                isThinking: false,
                toolEvents: [...s.toolEvents, { name: event.name, args: event.args }],
              }));
            } else if (event.type === "done") {
              setState((s) => ({
                ...s,
                isStreaming: false,
                isThinking: false,
                proposalsCreated: event.proposals_created,
              }));
            }
          },
          controller.signal,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "error de chat";
        setState((s) => ({
          ...s,
          isStreaming: false,
          isThinking: false,
          error: message,
        }));
        return;
      }

      // Refresh server-side message log + pending list, but keep
      // pendingUserText / liveText visible until the refetch lands so
      // the UI doesn't flash blank.
      await queryClient.invalidateQueries({
        queryKey: ["anita", "messages", sessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["pending"] });

      setState((s) => ({ ...s, pendingUserText: null, liveText: "" }));
    },
    [sessionId, queryClient],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    setState((s) => ({ ...s, isStreaming: false, isThinking: false }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, send, cancel, reset };
}
