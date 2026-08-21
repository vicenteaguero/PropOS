export interface AgentSession {
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

export interface AgentTranscript {
  transcript_id: string;
  text: string;
  language: string | null;
  duration_seconds: number | null;
  source: "browser_speech" | "groq_whisper" | "openai_whisper" | "manual_text";
}

export interface AgentMessageBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  tool_call_id?: string;
}

export interface AgentMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: AgentMessageBlock[] | { text: string } | string;
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

export type ProposalStatus = "pending" | "accepted" | "rejected" | "superseded" | "expired";

/**
 * What the human actually said that produced a proposal.
 *
 * Null on every row created before the agent started recording it, so every
 * consumer has to handle its absence — an empty quote block is worse than no
 * quote block.
 */
export interface ProposalEvidence {
  /** Verbatim fragment. Already in the speaker's language. */
  quote?: string;
  source?: "whatsapp" | "email" | "voice" | "chat";
  conversation_id?: string;
  client_message_id?: string;
  transcript_id?: string;
}

/** `pending/schemas.py` → `RejectReason`. */
export type ProposalRejectReason =
  | "dato_incorrecto"
  | "entidad_equivocada"
  | "no_corresponde"
  | "duplicado"
  | "otro";

export interface PendingProposal {
  id: string;
  tenant_id: string;
  agent_session_id: string;
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
  // Optional rather than required: the API's response model has to opt each
  // new column in, so an older backend simply omits them.
  review_reason?: ProposalRejectReason | null;
  evidence?: ProposalEvidence | null;
  created_row_id: string | null;
  created_at: string;
  updated_at: string;
}
