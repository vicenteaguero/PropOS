import { apiRequest } from "@features/documents/api/http";
import { ENV } from "@core/config/env";
import { supabase } from "@core/supabase/client";
import type {
  AnitaMessage,
  AnitaSession,
  AnitaTranscript,
  ChatStreamEvent,
} from "../types";

const BASE = "/v1/anita";

export const anitaApi = {
  createOrResumeSession: () =>
    apiRequest<AnitaSession>(`${BASE}/sessions`, { method: "POST", body: {} }),

  listMessages: (sessionId: string) =>
    apiRequest<AnitaMessage[]>(`${BASE}/sessions/${sessionId}/messages`),

  /** Persist a Web Speech API result (no server-side STT call). */
  transcribeText: (
    text: string,
    sessionId?: string,
    mediaFileId?: string,
  ) =>
    apiRequest<AnitaTranscript>(`${BASE}/transcribe-text`, {
      method: "POST",
      body: {
        text,
        session_id: sessionId,
        media_file_id: mediaFileId,
      },
    }),

  /** Server-side transcription (Groq Whisper fallback path). */
  transcribeAudio: (blob: Blob, sessionId?: string, mediaFileId?: string) => {
    const fd = new FormData();
    fd.append("audio", blob, "anita-audio.webm");
    if (sessionId) fd.append("session_id", sessionId);
    if (mediaFileId) fd.append("media_file_id", mediaFileId);
    return apiRequest<AnitaTranscript>(`${BASE}/transcribe`, {
      method: "POST",
      formData: fd,
    });
  },

  closeSession: (sessionId: string) =>
    apiRequest<AnitaSession>(`${BASE}/sessions/${sessionId}/close`, {
      method: "POST",
    }),
};

/** SSE chat consumer. Pushes parsed events to onEvent. */
export async function streamChat(
  sessionId: string,
  userText: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`${ENV.API_URL}/api${BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ session_id: sessionId, user_text: userText }),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`Anita chat HTTP ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload) as ChatStreamEvent;
        onEvent(parsed);
      } catch {
        // skip malformed line
      }
    }
  }
}
