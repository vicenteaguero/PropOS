import { supabase } from "@core/supabase/client";
import type {
  Conversation,
  ConversationParticipant,
  ConversationRow,
  Message,
  MessageRow,
} from "@features/chat/types";

function mapConversationRow(row: ConversationRow): Conversation {
  const participants: ConversationParticipant[] =
    row.conversation_participants?.map((p) => ({
      id: p.id,
      conversationId: row.id,
      userId: p.user_id,
      tenantId: row.tenant_id,
      joinedAt: "",
      profile: p.profiles
        ? { id: p.profiles.id, fullName: p.profiles.full_name, role: p.profiles.role }
        : undefined,
    })) ?? [];

  const lastMsg = row.messages?.[0] ?? null;

  return {
    id: row.id,
    title: row.title,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participants,
    lastMessage: lastMsg
      ? {
          id: lastMsg.id,
          conversationId: row.id,
          senderId: lastMsg.sender_id,
          content: lastMsg.content,
          tenantId: row.tenant_id,
          createdAt: lastMsg.created_at,
        }
      : null,
  };
}

function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    sender: row.profiles
      ? { id: row.profiles.id, fullName: row.profiles.full_name }
      : undefined,
  };
}

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `
      id, title, tenant_id, created_at, updated_at,
      conversation_participants (
        id, user_id,
        profiles:user_id ( id, full_name, role )
      ),
      messages ( id, content, sender_id, created_at )
    `,
    )
    .order("updated_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });

  if (error) throw error;
  return (data as unknown as ConversationRow[]).map(mapConversationRow);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id, conversation_id, sender_id, content, tenant_id, created_at,
      profiles:sender_id ( id, full_name )
    `,
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as unknown as MessageRow[]).map(mapMessageRow);
}

export async function sendMessage(
  conversationId: string,
  content: string,
  senderId: string,
  tenantId: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      tenant_id: tenantId,
    })
    .select(
      `
      id, conversation_id, sender_id, content, tenant_id, created_at,
      profiles:sender_id ( id, full_name )
    `,
    )
    .single();

  if (error) throw error;

  // Update conversation's updated_at
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return mapMessageRow(data as unknown as MessageRow);
}

export async function createConversation(
  title: string | null,
  participantIds: string[],
  tenantId: string,
): Promise<Conversation> {
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({ title, tenant_id: tenantId })
    .select("id, title, tenant_id, created_at, updated_at")
    .single();

  if (convError) throw convError;

  const participants = participantIds.map((userId) => ({
    conversation_id: conv.id,
    user_id: userId,
    tenant_id: tenantId,
  }));

  const { error: partError } = await supabase
    .from("conversation_participants")
    .insert(participants);

  if (partError) throw partError;

  return {
    id: conv.id,
    title: conv.title,
    tenantId: conv.tenant_id,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    participants: [],
    lastMessage: null,
  };
}

export async function listTenantUsers(): Promise<
  { id: string; fullName: string; role: string }[]
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("is_active", true)
    .order("full_name");

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    role: p.role,
  }));
}
