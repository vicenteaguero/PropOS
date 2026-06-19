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

  const backToList = () => navigate(`/${role}/personas`);

  return (
    <PageLayout width="md" noPadding>
      <ContactDetail contactId={id ?? ""} onBack={backToList} onDeleted={backToList} />
    </PageLayout>
  );
}
