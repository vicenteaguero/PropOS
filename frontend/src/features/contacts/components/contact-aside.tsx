import { SectionLabel } from "@shared/ui";
import { InteractionsList } from "@features/interactions/components/interactions-list";

/**
 * 2xl context rail for the desktop master-detail.
 *
 * It used to list the contact's opportunities, which the summary block on the
 * page itself now carries — so on a wide monitor the same two deals appeared
 * twice, six inches apart, with two different treatments. The rail shows the
 * history instead: what the summary cannot, because a timeline is long.
 */
export function ContactAside({ contactId }: { contactId: string }) {
  return (
    <div className="space-y-5 p-[var(--page-x)]">
      <SectionLabel>Historial</SectionLabel>
      <InteractionsList personId={contactId} />
    </div>
  );
}
