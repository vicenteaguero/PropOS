import { apiRequest } from "@shared/api/http";

export interface EmailThread {
  id: string;
  tenant_id: string;
  subject: string | null;
  counterpart_email: string | null;
  counterpart_name: string | null;
  contact_id: string | null;
  last_message_at: string | null;
  message_count: number;
  is_lead: boolean;
  portal: string | null;
  status: string;
}

export interface EmailMessage {
  id: string;
  direction: "IN" | "OUT";
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  snippet: string | null;
  sent_at: string;
  is_lead_email: boolean;
  portal: string | null;
}

export interface EmailThreadDetail extends EmailThread {
  messages: EmailMessage[];
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  contact_id?: string | null;
}

export const emailApi = {
  listThreads: (params: { status?: string; contact_id?: string; q?: string } = {}) =>
    apiRequest<EmailThread[]>(`/v1/email/threads${qs({ ...params })}`),
  getThread: (id: string) => apiRequest<EmailThreadDetail>(`/v1/email/threads/${id}`),
  reply: (id: string, body: string) =>
    apiRequest<unknown>(`/v1/email/threads/${id}/reply`, { method: "POST", body: { body } }),
  send: (input: SendEmailInput) =>
    apiRequest<EmailThread>("/v1/email/send", { method: "POST", body: input }),
  archive: (id: string) =>
    apiRequest<unknown>(`/v1/email/threads/${id}/archive`, { method: "POST", body: {} }),
};
