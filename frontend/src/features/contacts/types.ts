export type ContactType = "LANDOWNER" | "BUYER" | "SELLER" | "TENANT" | "AGENT" | "INVESTOR" | "OTHER";

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
