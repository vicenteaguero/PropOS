import { useQuery } from "@tanstack/react-query";
import { attentionKeys, fetchAttention } from "../api/attention-api";

/**
 * Inbound WhatsApp messages this user has not read, across every thread.
 *
 * Read off the attention feed rather than a count endpoint of its own: the
 * feed is already fetched on Inicio and on Conversaciones, already carries
 * `unread` per row, and is already scoped to the caller. A second endpoint
 * would be a second source of truth for the same number.
 *
 * The badge on the nav is the reason this exists at all: "82 sin responder"
 * on a screen you are not looking at is the only way a broker learns that a
 * client wrote while they were on another tab.
 */
export function useUnreadCount(): number {
  const { data } = useQuery({
    queryKey: attentionKeys.feed(50, undefined),
    queryFn: () => fetchAttention(50),
    staleTime: 30_000,
    // The shell mounts this on every screen, so it must not fetch on focus —
    // that would be a request every time the app comes back from background.
    refetchOnWindowFocus: false,
  });
  return (data?.items ?? []).reduce((n, item) => n + (item.unread ?? 0), 0);
}
