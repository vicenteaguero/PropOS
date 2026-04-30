import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { anitaApi, streamChat } from "../api/anita-api";
import type { ChatStreamEvent } from "../types";

interface AnitaChatState {
  isStreaming: boolean;
  liveText: string;
  toolEvents: { name: string; args: Record<string, unknown> }[];
  proposalsCreated: string[];
  error: string | null;
}

const INITIAL: AnitaChatState = {
  isStreaming: false,
  liveText: "",
  toolEvents: [],
  proposalsCreated: [],
  error: null,
};

/**
 * Drives one chat turn: optionally calls /transcribe-text to persist the
 * Web Speech text, then streams /chat SSE.
 */
export function useAnitaChat(sessionId: string | undefined) {
  const [state, setState] = useState<AnitaChatState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const send = useCallback(
    async (userText: string) => {
      if (!sessionId || !userText.trim()) return;

      setState({ ...INITIAL, isStreaming: true });
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await anitaApi.transcribeText(userText, sessionId);
      } catch {
        // Non-fatal — chat can still proceed without persisted transcript
      }

      try {
        await streamChat(
          sessionId,
          userText,
          (event: ChatStreamEvent) => {
            if (event.type === "text") {
              setState((s) => ({ ...s, liveText: s.liveText + event.text }));
            } else if (event.type === "tool_use") {
              setState((s) => ({
                ...s,
                toolEvents: [...s.toolEvents, { name: event.name, args: event.args }],
              }));
            } else if (event.type === "done") {
              setState((s) => ({
                ...s,
                isStreaming: false,
                proposalsCreated: event.proposals_created,
              }));
            }
          },
          controller.signal,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "error de chat";
        setState((s) => ({ ...s, isStreaming: false, error: message }));
        return;
      }

      // Refresh server-side message log + pending list
      queryClient.invalidateQueries({ queryKey: ["anita", "messages", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["pending"] });
    },
    [sessionId, queryClient],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, send, cancel, reset };
}
