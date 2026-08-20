import { SectionLabel } from "@shared/ui";
import { ContactOpportunities } from "./contact-opportunities";

/**
 * 2xl context rail for the desktop master-detail. Surfaces the contact's
 * opportunities so the broker sees the pipeline without leaving the list.
 */
export function ContactAside({ contactId }: { contactId: string }) {
  return (
    <div className="space-y-5 p-[var(--page-x)]">
      <SectionLabel>Contexto</SectionLabel>
      <ContactOpportunities personId={contactId} />
    </div>
  );
}
