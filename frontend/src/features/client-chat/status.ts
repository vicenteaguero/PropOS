import type { PillTone } from "@shared/ui";
import { label } from "@shared/lib/labels";

/**
 * Presentation for `client_conversations.status`.
 *
 * The Spanish text comes from the shared label registry (`conversationStatus`),
 * which already knows the lowercase wire values. Only the tone lives here,
 * because `@shared/lib/tones` has no entry for this enum yet — when it grows
 * one, delete this map and read from there.
 */
export const CONVERSATION_STATUS_TONES: Record<string, PillTone> = {
  open: "success",
  assigned: "accent",
  closed: "neutral",
};

export function conversationStatusLabel(status: string): string {
  return label("conversationStatus", status);
}
