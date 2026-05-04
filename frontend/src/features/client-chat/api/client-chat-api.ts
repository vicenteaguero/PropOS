import { apiRequest } from "@features/documents/api/http";
import type {
  ClientConversation,
  ClientMessage,
  ConversationStatus,
} from "../types";

const BASE = "/v1/client-chat";

export const clientChatApi = {
  listConversations: (status?: ConversationStatus) => {
    const qs = status ? `?status=${status}` : "";
    return apiRequest<ClientConversation[]>(`${BASE}/conversations${qs}`);
  },

  listMessages: (conversationId: string) =>
    apiRequest<ClientMessage[]>(`${BASE}/conversations/${conversationId}/messages`),

  send: (conversationId: string, text: string) =>
    apiRequest<{ message_id: string }>(
      `${BASE}/conversations/${conversationId}/send`,
      { method: "POST", body: { text } },
    ),

  patch: (
    conversationId: string,
    body: { ai_enabled?: boolean; status?: ConversationStatus },
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
