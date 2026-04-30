export interface AnitaSession {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string | null;
  status: "OPEN" | "CLOSED";
  metadata: Record<string, unknown>;
  started_at: string;
  last_activity_at: string;
  closed_at: string | null;
}

export interface AnitaTranscript {
  transcript_id: string;
  text: string;
  language: string | null;
  duration_seconds: number | null;
  source: "browser_speech" | "groq_whisper" | "openai_whisper" | "manual_text";
}

export interface AnitaMessageBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  tool_call_id?: string;
}

export interface AnitaMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: AnitaMessageBlock[] | { text: string } | string;
  provider: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_cents: number | null;
  created_at: string;
}

export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; args: Record<string, unknown> }
  | { type: "proposals"; ids: string[] }
  | {
      type: "done";
      proposals_created: string[];
      tokens: { in: number; out: number };
      provider: string;
    };

export type ProposalStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "superseded"
  | "expired";

export interface PendingProposal {
  id: string;
  tenant_id: string;
  anita_session_id: string;
  proposed_by_user: string;
  kind: string;
  target_table: string | null;
  target_row_id: string | null;
  payload: Record<string, unknown>;
  resolved_payload: Record<string, unknown> | null;
  ambiguity: Record<string, unknown> | null;
  status: ProposalStatus;
  confidence: number | null;
  reviewer_user: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_row_id: string | null;
  created_at: string;
  updated_at: string;
}
