import { apiRequest } from "@shared/api/http";

export type FlagTargetKind = "CONTACT" | "PROPERTY";

export interface AttentionFlag {
  id: string;
  target_kind: FlagTargetKind;
  contact_id: string | null;
  property_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
}

const BASE = "/v1/attention-flags";

export const attentionFlagsApi = {
  list: () => apiRequest<AttentionFlag[]>(BASE),

  set: (target_kind: FlagTargetKind, target_id: string, hours = 48) =>
    apiRequest<AttentionFlag>(BASE, { method: "POST", body: { target_kind, target_id, hours } }),

  clear: (target_kind: FlagTargetKind, target_id: string) =>
    apiRequest<void>(`${BASE}/${target_kind}/${target_id}`, { method: "DELETE" }),
};
