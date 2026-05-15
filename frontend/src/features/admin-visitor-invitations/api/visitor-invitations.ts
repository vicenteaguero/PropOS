import { apiRequest } from "@features/documents/api/http";

export interface InvitationResponse {
  id: string;
  tenant_id: string;
  slug: string;
  email: string;
  property_id: string;
  mode: "visitor_only" | "auth_user";
  status: "pending" | "opened" | "completed" | "expired";
  expires_at: string;
  invite_url: string;
  contact_id: string | null;
  user_id: string | null;
  id_document_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PreflightResponse {
  contact_exists_in_this_tenant: boolean;
  contact_exists_in_other_tenant: boolean;
  other_tenant_slugs: string[];
  auth_user_exists: boolean;
  warnings: string[];
}

export interface InvitationCreatePayload {
  email: string;
  property_id: string;
  mode: "visitor_only" | "auth_user";
  expires_in_days?: number;
  confirm_duplicate?: boolean;
}

export function listInvitations(params?: {
  status?: string;
  property_id?: string;
}): Promise<InvitationResponse[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.property_id) qs.set("property_id", params.property_id);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiRequest(`/v1/visitor-invitations${suffix}`);
}

export function preflightInvitation(email: string, rut?: string): Promise<PreflightResponse> {
  const qs = new URLSearchParams({ email });
  if (rut) qs.set("rut", rut);
  return apiRequest(`/v1/visitor-invitations/preflight?${qs}`);
}

export function createInvitation(payload: InvitationCreatePayload): Promise<InvitationResponse> {
  return apiRequest(`/v1/visitor-invitations`, { method: "POST", body: payload });
}

export function resendInvitation(invitationId: string): Promise<InvitationResponse> {
  return apiRequest(`/v1/visitor-invitations/${invitationId}/resend`, { method: "POST" });
}

export function expireInvitation(invitationId: string): Promise<void> {
  return apiRequest(`/v1/visitor-invitations/${invitationId}`, { method: "DELETE" });
}
