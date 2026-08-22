import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  attentionFlagsApi,
  type AttentionFlag,
  type FlagTargetKind,
} from "../api/attention-flags-api";

const KEY = ["attention-flags"] as const;

/**
 * The workspace's live "watch this" marks.
 *
 * Shared, so every surface reads the same list and one fetch serves the deal
 * board, the inbox and a contact's page at once.
 */
export function useAttentionFlags() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => attentionFlagsApi.list(),
    staleTime: 60_000,
  });
}

/** `contacts.has(id)` — the shape a list actually needs. */
export function useFlaggedIds(): {
  contacts: Set<string>;
  properties: Set<string>;
  byId: Map<string, AttentionFlag>;
} {
  const { data } = useAttentionFlags();
  const contacts = new Set<string>();
  const properties = new Set<string>();
  const byId = new Map<string, AttentionFlag>();
  for (const flag of data ?? []) {
    if (flag.contact_id) {
      contacts.add(flag.contact_id);
      byId.set(flag.contact_id, flag);
    }
    if (flag.property_id) {
      properties.add(flag.property_id);
      byId.set(flag.property_id, flag);
    }
  }
  return { contacts, properties, byId };
}

export function useToggleAttentionFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id, on }: { kind: FlagTargetKind; id: string; on: boolean }) => {
      if (on) await attentionFlagsApi.set(kind, id);
      else await attentionFlagsApi.clear(kind, id);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      // The queue's ORDER depends on this, so it has to be asked again.
      qc.invalidateQueries({ queryKey: ["attention"] });
    },
  });
}
