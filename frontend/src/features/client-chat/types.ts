export type ConversationStatus = "open" | "assigned" | "closed";
export type ChannelSource = "whatsapp" | "email" | "web";
export type MessageDirection = "inbound" | "outbound";
export type SenderType = "contact" | "agent_ai" | "agent_human";
export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export interface ClientConversation {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  source: ChannelSource;
  external_thread_id: string | null;
  external_phone_e164: string | null;
  status: ConversationStatus;
  assigned_user_id: string | null;
  ai_enabled: boolean;
  last_inbound_at: string | null;
  last_message_at: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface ClientMessage {
  id: string;
  tenant_id: string;
  conversation_id: string;
  direction: MessageDirection;
  sender_type: SenderType;
  sender_user_id: string | null;
  content: string;
  media_url: string | null;
  media_mime: string | null;
  external_message_id: string | null;
  template_name: string | null;
  delivery_status: DeliveryStatus;
  failure_reason: string | null;
  created_at: string;
}

export interface ClientConsent {
  id: string;
  tenant_id: string;
  contact_id: string;
  channel: "whatsapp" | "email";
  opted_in_at: string | null;
  opted_out_at: string | null;
  method: string | null;
  proof: Record<string, unknown>;
}
