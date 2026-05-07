import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { agentApi, streamMessage } from "../api/agent-api";
import type { ChatStreamEvent } from "../types";
import type { PendingAudioMessage } from "../components/agent-message-list";

interface AgentChatState {
  isStreaming: boolean;
  isThinking: boolean;
  pendingUserText: string | null;
  pendingAudio: PendingAudioMessage[];
  liveText: string;
  toolEvents: { name: string; args: Record<string, unknown> }[];
  proposalsCreated: string[];
  error: string | null;
}

const INITIAL: AgentChatState = {
  isStreaming: false,
  isThinking: false,
  pendingUserText: null,
  pendingAudio: [],
  liveText: "",
  toolEvents: [],
  proposalsCreated: [],
  error: null,
};

/**
 * Drives one chat turn over SSE.
 *
 * Audio flow: composer calls `submitAudio(blob, url)` immediately on
 * stop. We push a transient audio bubble (so it's visible as a sent
 * message), POST /agent/transcripts in background, and once the text
 * arrives we kick off a normal `send`. The audio bubble stays in the
 * UI with a collapsible "Ver transcripción" affordance.
 */
export function useAgentChat(sessionId: string | undefined) {
  const [state, setState] = useState<AgentChatState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const send = useCallback(
    async (userText: string, opts?: { silent?: boolean }) => {
      if (!sessionId || !userText.trim()) return;

      setState((s) => ({
        ...s,
        isStreaming: true,
        isThinking: false,
        pendingUserText: opts?.silent ? null : userText,
        liveText: "",
        toolEvents: [],
        proposalsCreated: [],
        error: null,
      }));
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

      await queryClient.invalidateQueries({
        queryKey: ["agent", "messages", sessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["pending"] });

      setState((s) => ({ ...s, pendingUserText: null, liveText: "" }));
    },
    [sessionId, queryClient],
  );

  const submitAudio = useCallback(
    async (blob: Blob, url: string) => {
      if (!sessionId) return;
      const id = `audio-${Date.now()}`;
      setState((s) => ({
        ...s,
        pendingAudio: [
          ...s.pendingAudio,
          { id, url, transcribing: true, transcript: null, error: null },
        ],
      }));
      try {
        const result = await agentApi.createTranscript(blob, sessionId);
        setState((s) => ({
          ...s,
          pendingAudio: s.pendingAudio.map((a) =>
            a.id === id ? { ...a, transcribing: false, transcript: result.text } : a,
          ),
        }));
        if (result.text.trim()) {
          await send(result.text.trim(), { silent: true });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "transcripción falló";
        setState((s) => ({
          ...s,
          pendingAudio: s.pendingAudio.map((a) =>
            a.id === id ? { ...a, transcribing: false, error: msg } : a,
          ),
        }));
      }
    },
    [sessionId, send],
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

  return { ...state, send, submitAudio, cancel, reset };
}
