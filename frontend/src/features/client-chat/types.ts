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
  archived_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  /** Who the thread is waiting on. Maintained by a trigger on every message. */
  waiting_on: "client" | "us" | "nobody" | null;
  first_response_at: string | null;
  first_response_due_at: string | null;
  /**
   * Resolved by the list endpoint, not stored on the row.
   *
   * The inbox is read by name and by property; the browser used to build both
   * itself from a 500-contact and a 500-opportunity fetch on every visit. Null
   * when the thread has no contact, or no open deal pointing at a property.
   */
  contact_name?: string | null;
  property_title?: string | null;
}

/** What a thread is about. Mirrors `conversation_targets`. */
export interface ConversationTarget {
  id: string;
  conversation_id: string;
  target_kind: "PROPERTY" | "OPPORTUNITY";
  property_id: string | null;
  opportunity_id: string | null;
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

/** An approved WhatsApp template. Mirrors `message_templates`. */
export interface MessageTemplate {
  name: string;
  body: string;
  /** Ordered names, mapped onto Meta's positional {{1}}..{{n}}. */
  variables: string[];
  category: string;
  language: string;
}
