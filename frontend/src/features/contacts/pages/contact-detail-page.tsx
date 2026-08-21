import { useNavigate, useParams } from "react-router-dom";
import { PageLayout } from "@shared/components/page-layout";
import { useAuth } from "@shared/hooks/use-auth";
import { ContactDetail } from "../components/contact-detail";

/**
 * Standalone contact detail route (`/<role>/personas/:id`). Kept for deep-links
 * and mobile push-navigation; the body is the shared <ContactDetail>, which the
 * desktop master-detail in <ContactsPage> renders inline instead.
 */
export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const backToList = () => navigate(`/${role}/clientes?tab=personas`);
  // Named by the record, not by its type: the shell top bar prints this, and
  // "Persona" over a page already showing the person's name said nothing.
  // ContactDetail owns the name, so the page title follows it from there.

  // Deep links land here on every viewport (the list page only routes to it on
  // phones).
  //
  // There used to be a 20rem context rail beside this column. It listed the
  // contact's deals, which the summary block now carries, and then their
  // interactions, which the tabs below already show — a full-width table
  // squeezed into a rail, with its columns cut off at the edge. Nothing was
  // left for it to add that the page did not already say.
  return (
    <PageLayout width="md">
      <ContactDetail contactId={id ?? ""} onBack={backToList} onDeleted={backToList} />
    </PageLayout>
  );
}
