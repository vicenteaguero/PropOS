import { ENV } from "@core/config/env";

const PUBLIC_BASE = `${ENV.API_URL}/api/v1/public/visitor-invitations`;

export interface InvitationPublicView {
  slug: string;
  email: string;
  property_title: string;
  property_address: string | null;
  tenant_slug: string;
  mode: "visitor_only" | "auth_user";
  consent_template_version: string;
  existing_in_this_tenant: boolean;
  existing_account: boolean;
  prefilled: {
    full_name?: string;
    rut?: string;
    phone?: string;
    address?: string;
  } | null;
  has_id_document: boolean;
}

export interface SubmitPayload {
  full_name: string;
  rut: string;
  phone?: string;
  address?: string;
  password?: string;
  consent_evidence: {
    ip?: string;
    user_agent?: string;
    text_shown?: string;
    channel?: string;
  };
}

export interface SubmitResponse {
  contact_id: string;
  user_id: string | null;
  message: string;
  requires_email_confirmation: boolean;
}

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PUBLIC_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function fetchInvitation(slug: string): Promise<InvitationPublicView> {
  return publicFetch(`/${slug}`);
}

export async function uploadId(slug: string, pdfBlob: Blob): Promise<{ document_id: string }> {
  const fd = new FormData();
  fd.append("file", pdfBlob, "cedula.pdf");
  return publicFetch(`/${slug}/upload-id`, { method: "POST", body: fd });
}

export function submitInvitation(slug: string, payload: SubmitPayload): Promise<SubmitResponse> {
  return publicFetch(`/${slug}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
