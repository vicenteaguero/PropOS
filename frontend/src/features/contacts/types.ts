export const CONTACT_TYPES = [
  "BUYER",
  "SELLER",
  "LANDOWNER",
  "NOTARY",
  "INVESTOR",
  "EMPLOYEE",
  "FAMILY",
  "VENDOR",
  "STAKEHOLDER",
  "OTHER",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

// Labels + tones live in the shared registries so every surface agrees.
// Re-exported here because callers already import them from this module.
export { CONTACT_TYPE_LABELS } from "@shared/lib/labels";
export { CONTACT_TYPE_TONES } from "@shared/lib/tones";

export interface Contact {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  type: ContactType;
  rut: string | null;
  birthdate: string | null;
  address: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ContactInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  type?: ContactType;
  rut?: string | null;
  address?: string | null;
  notes?: string | null;
}
