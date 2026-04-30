export interface Conversation {
  id: string;
  title: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  participants?: ConversationParticipant[];
  lastMessage?: Message | null;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  tenantId: string;
  joinedAt: string;
  profile?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string;
  tenantId: string;
  createdAt: string;
  sender?: {
    id: string;
    fullName: string;
  };
}

export interface ConversationRow {
  id: string;
  title: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  conversation_participants: {
    id: string;
    user_id: string;
    profiles: {
      id: string;
      full_name: string;
      role: string;
    };
  }[];
  messages: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
  }[];
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  tenant_id: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string;
  } | null;
}
