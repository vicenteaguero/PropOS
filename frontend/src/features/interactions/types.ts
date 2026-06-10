export const INTERACTION_KINDS = [
  "VISIT",
  "CALL",
  "EMAIL",
  "WHATSAPP_LOG",
  "NOTE",
  "MEETING",
  "SHOWING",
  "OTHER",
] as const;

export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const INTERACTION_KIND_LABELS: Record<InteractionKind, string> = {
  VISIT: "Visita",
  CALL: "Llamada",
  EMAIL: "Email",
  WHATSAPP_LOG: "WhatsApp",
  NOTE: "Nota",
  MEETING: "Reunión",
  SHOWING: "Muestra",
  OTHER: "Otro",
};

export interface Interaction {
  id: string;
  tenant_id: string;
  kind: InteractionKind;
  occurred_at: string | null;
  duration_minutes: number | null;
  channel: string | null;
  summary: string | null;
  body: string | null;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  source: string;
  created_at: string;
  participants: Array<Record<string, unknown>>;
  targets: Array<Record<string, unknown>>;
}

export interface InteractionInput {
  kind: InteractionKind;
  occurred_at?: string | null;
  summary?: string | null;
  body?: string | null;
  channel?: string | null;
  participants?: Array<{ person_id: string; role?: string | null }>;
  targets?: Array<{ target_kind: "PROPERTY"; property_id: string }>;
}
