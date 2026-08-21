import { apiRequest } from "@shared/api/http";
import type {
  ClientConversation,
  ClientMessage,
  ConversationStatus,
  ConversationTarget,
} from "../types";

const BASE = "/v1/client-chat";

export const clientChatApi = {
  listConversations: (
    status?: ConversationStatus,
    archived = false,
    opts: { waitingOn?: "client" | "us" | "nobody"; unidentified?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (archived) params.set("archived", "true");
    if (opts.waitingOn) params.set("waiting_on", opts.waitingOn);
    if (opts.unidentified !== undefined) params.set("unidentified", String(opts.unidentified));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<ClientConversation[]>(`${BASE}/conversations${qs}`);
  },

  /** Point an unidentified thread at a person, filing the number under them. */
  linkContact: (conversationId: string, contactId: string) =>
    apiRequest<ClientConversation>(`${BASE}/conversations/${conversationId}/contact`, {
      method: "POST",
      body: { contact_id: contactId },
    }),

  listTargets: (conversationId: string) =>
    apiRequest<ConversationTarget[]>(`${BASE}/conversations/${conversationId}/targets`),

  addTarget: (
    conversationId: string,
    target: {
      target_kind: "PROPERTY" | "OPPORTUNITY";
      property_id?: string;
      opportunity_id?: string;
    },
  ) =>
    apiRequest<ConversationTarget>(`${BASE}/conversations/${conversationId}/targets`, {
      method: "POST",
      body: target,
    }),

  removeTarget: (conversationId: string, targetId: string) =>
    apiRequest<void>(`${BASE}/conversations/${conversationId}/targets/${targetId}`, {
      method: "DELETE",
    }),

  listMessages: (conversationId: string) =>
    apiRequest<ClientMessage[]>(`${BASE}/conversations/${conversationId}/messages`),

  send: (conversationId: string, text: string) =>
    apiRequest<{ message_id: string }>(`${BASE}/conversations/${conversationId}/send`, {
      method: "POST",
      body: { text },
    }),

  patch: (
    conversationId: string,
    body: { ai_enabled?: boolean; status?: ConversationStatus; archived?: boolean },
  ) =>
    apiRequest<ClientConversation>(`${BASE}/conversations/${conversationId}`, {
      method: "PATCH",
      body,
    }),

  upsertConsent: (contactId: string, method = "broker_attestation") =>
    apiRequest(`${BASE}/consents`, {
      method: "POST",
      body: { contact_id: contactId, channel: "whatsapp", method },
    }),

  revokeConsent: (contactId: string) =>
    apiRequest(`${BASE}/consents/${contactId}?channel=whatsapp`, {
      method: "DELETE",
    }),
};
