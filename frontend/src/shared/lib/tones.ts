import type { PillTone } from "@shared/ui";

/**
 * Semantic tone per enum value, the visual counterpart to `./labels`.
 *
 * These maps kept being re-declared next to whatever rendered them — the
 * contact-type tones existed twice in the same feature, the property listing
 * tones twice across two pages of another. Colour carries meaning here (a
 * "success" pill says the deal closed), so two copies drifting apart is a
 * correctness problem, not just a styling one.
 *
 * Labels live in `./labels`; tones live here. Import both when you need a Pill.
 */

/** `contacts/types.ts` → `ContactType`. */
export const CONTACT_TYPE_TONES: Record<string, PillTone> = {
  BUYER: "accent",
  SELLER: "success",
  LANDOWNER: "warning",
  NOTARY: "neutral",
  INVESTOR: "accent",
  EMPLOYEE: "neutral",
  FAMILY: "neutral",
  VENDOR: "neutral",
  STAKEHOLDER: "neutral",
  OTHER: "neutral",
};

/** `finance` → `Transaction.status`. Pairs with `TX_STATUS_LABELS`. */
export const TX_STATUS_TONES: Record<string, PillTone> = {
  PENDING: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

/** `properties` → `listing_kind`. Pairs with `LISTING_KIND_LABELS`. */
export const LISTING_KIND_TONES: Record<string, PillTone> = {
  SALE: "success",
  RENT: "warning",
  LEASE: "accent",
};

/** Tone for a value, falling back to the neutral pill for anything unmapped. */
export function tone(map: Record<string, PillTone>, value: string | null | undefined): PillTone {
  if (!value) return "neutral";
  return map[value] ?? map[value.toUpperCase()] ?? "neutral";
}
