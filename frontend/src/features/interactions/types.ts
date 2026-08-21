// One registry, in shared/lib/labels.ts. The copy that lived here disagreed
// with it on four of eight keys.
export {
  INTERACTION_KINDS,
  INTERACTION_KIND_LABELS_SHARED as INTERACTION_KIND_LABELS,
} from "@shared/lib/labels";
import type { InteractionKind } from "@shared/lib/labels";

export type { InteractionKind };

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
