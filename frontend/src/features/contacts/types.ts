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

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  BUYER: "Comprador",
  SELLER: "Vendedor",
  LANDOWNER: "Propietario",
  NOTARY: "Notaría",
  INVESTOR: "Inversionista",
  EMPLOYEE: "Empleado",
  FAMILY: "Familia",
  VENDOR: "Proveedor",
  STAKEHOLDER: "Stakeholder",
  OTHER: "Otro",
};

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
