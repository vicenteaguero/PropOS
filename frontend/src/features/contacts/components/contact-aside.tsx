import { SectionLabel } from "@shared/ui";
import { ContactOpportunities } from "./contact-opportunities";

/**
 * 2xl context rail for the desktop master-detail. Surfaces the contact's
 * opportunities so the broker sees the pipeline without leaving the list.
 */
export function ContactAside({ contactId }: { contactId: string }) {
  return (
    <div className="space-y-6 p-5">
      <div>
        <SectionLabel className="px-0">Contexto</SectionLabel>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Pipeline y oportunidades de esta persona.
        </p>
      </div>
      <ContactOpportunities personId={contactId} />
    </div>
  );
}
