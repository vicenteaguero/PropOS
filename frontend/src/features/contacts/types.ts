export type ContactType = "buyer" | "seller" | "tenant" | "agent" | "investor" | "other";

export interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  type: ContactType;
  tenant_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
