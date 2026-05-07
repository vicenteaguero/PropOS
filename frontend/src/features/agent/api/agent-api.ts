import { apiRequest } from "@features/documents/api/http";
import { ENV } from "@core/config/env";
import { supabase } from "@core/supabase/client";
import type { AgentMessage, AgentSession, AgentTranscript, ChatStreamEvent } from "../types";

const BASE = "/v1/agent";

export interface AgentSessionListItem {
  id: string;
  status: "OPEN" | "CLOSED";
  started_at: string;
  last_activity_at: string;
  closed_at: string | null;
  preview: string;
}

export const agentApi = {
  createOrResumeSession: (opts?: { forceNew?: boolean }) =>
    apiRequest<AgentSession>(`${BASE}/sessions${opts?.forceNew ? "?force_new=true" : ""}`, {
      method: "POST",
      body: {},
    }),

  listSessions: () => apiRequest<AgentSessionListItem[]>(`${BASE}/sessions`),

  listMessages: (sessionId: string) =>
    apiRequest<AgentMessage[]>(`${BASE}/sessions/${sessionId}/messages`),

  /** Server-side transcription. Audio multipart → POST /agent/transcripts. */
  createTranscript: (blob: Blob, sessionId?: string, mediaFileId?: string) => {
    const fd = new FormData();
    fd.append("audio", blob, "agent-audio.webm");
    if (sessionId) fd.append("session_id", sessionId);
    if (mediaFileId) fd.append("media_file_id", mediaFileId);
    return apiRequest<AgentTranscript>(`${BASE}/transcripts`, {
      method: "POST",
      formData: fd,
    });
  },

  updateSession: (sessionId: string, body: { status?: "OPEN" | "CLOSED"; title?: string }) =>
    apiRequest<AgentSession>(`${BASE}/sessions/${sessionId}`, {
      method: "PATCH",
      body,
    }),
};

/** SSE message stream. POST /agent/sessions/{id}/messages. */
export async function streamMessage(
  sessionId: string,
  body: { user_text?: string; transcript_id?: string },
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`${ENV.API_URL}/api${BASE}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`Anita message HTTP ${response.status}: ${text}`);
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
