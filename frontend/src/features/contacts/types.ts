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

/** Mirrors `ContactOverview` on the API. */
export interface OverviewCounts {
  interactions: number;
  deals: number;
  notes: number;
  documents: number;
  emails: number;
  open_tasks: number;
}

export interface OverviewEvent {
  id: string;
  kind: string | null;
  title: string | null;
  starts_at: string;
  location: string | null;
  property_title: string | null;
}

export interface OverviewDeal {
  id: string;
  pipeline_stage: string | null;
  property_id: string | null;
  property_title: string | null;
  expected_value_cents: number | null;
  currency: string | null;
}

export interface OverviewProperty {
  id: string;
  title: string;
}

export interface ContactOverview {
  last_interaction_at: string | null;
  last_interaction_kind: string | null;
  next_event: OverviewEvent | null;
  deals: OverviewDeal[];
  properties: OverviewProperty[];
  conversation_id: string | null;
  awaiting_reply: boolean;
  counts: OverviewCounts;
}

/** Mirrors `ContactPhoneOut` on the API. */
export interface ContactPhone {
  id: string;
  e164: string;
  label: string | null;
  is_primary: boolean;
  verified_at: string | null;
}

export interface ContactEmail {
  id: string;
  address: string;
  label: string | null;
  is_primary: boolean;
  verified_at: string | null;
}

/**
 * Every way to reach a person.
 *
 * `contacts.phone` / `.email` are the primary of each list, mirrored by a
 * trigger for the readers that still expect a scalar column.
 */
export interface ContactChannels {
  phones: ContactPhone[];
  emails: ContactEmail[];
}

/** A pair the system thinks is one person. Detection proposes; a human decides. */
export interface ContactDuplicate {
  contact_id: string;
  contact_name: string;
  duplicate_id: string;
  duplicate_name: string;
  /** Spanish, shown as-is: "mismo teléfono", "mismo RUT". */
  reason: string;
  score: number;
}
