import { useQuery } from "@tanstack/react-query";
import {
  attentionKeys,
  fetchAttention,
  type AttentionFeed,
  type AttentionKind,
} from "../api/attention-api";

/**
 * Everything waiting on a person, ranked.
 *
 * Short stale time on purpose: this is the one list whose whole value is being
 * current — an answered message that keeps showing as unanswered is worse than
 * no queue at all.
 */
export function useAttention(limit = 60, kinds?: AttentionKind[]) {
  return useQuery<AttentionFeed>({
    queryKey: attentionKeys.feed(limit, kinds),
    queryFn: () => fetchAttention(limit, kinds),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
