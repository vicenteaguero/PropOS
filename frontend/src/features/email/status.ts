import type { PillTone } from "@shared/ui";

/**
 * Presentation for `email_threads.status`.
 *
 * The column is `CHECK (status IN ('OPEN', 'ARCHIVED'))` — see migration
 * `20240601000038_email_sync.sql`. The inbox used to carry a private helper
 * that tested `=== "OPEN"` and labelled *everything else* "Cerrada", so every
 * archived thread claimed a state the schema cannot even express.
 *
 * This belongs in `@shared/lib/labels` + `@shared/lib/tones` as an
 * `emailThreadStatus` kind; it sits here until that registry accepts it.
 */
export const EMAIL_STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierta",
  ARCHIVED: "Archivada",
};

export const EMAIL_STATUS_TONES: Record<string, PillTone> = {
  OPEN: "success",
  ARCHIVED: "neutral",
};

/** Falls through to the raw value so a new state shows up instead of lying. */
export function emailStatusLabel(status: string): string {
  return EMAIL_STATUS_LABELS[status.toUpperCase()] ?? status;
}
