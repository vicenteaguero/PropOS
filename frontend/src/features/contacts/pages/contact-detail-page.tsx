import { useNavigate, useParams } from "react-router-dom";
import { PageLayout } from "@shared/components/page-layout";
import { useAuth } from "@shared/hooks/use-auth";
import { ContactDetail } from "../components/contact-detail";
import { ContactAside } from "../components/contact-aside";
import { usePageTitle } from "@app/page-meta";

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
  usePageTitle("Persona");

  // Deep links land here on every viewport (the list page only routes to it on
  // phones). On a wide screen a lone 896px column wasted most of the display,
  // so pair the detail with the same context rail the master-detail renders.
  return (
    <PageLayout width="md" noPadding className="xl:max-w-none xl:px-8 xl:py-7">
      <div className="xl:grid xl:[grid-template-columns:minmax(0,1fr)_20rem] xl:gap-8">
        <ContactDetail contactId={id ?? ""} onBack={backToList} onDeleted={backToList} />
        {id && (
          <aside className="hidden xl:block">
            <ContactAside contactId={id} />
          </aside>
        )}
      </div>
    </PageLayout>
  );
}
