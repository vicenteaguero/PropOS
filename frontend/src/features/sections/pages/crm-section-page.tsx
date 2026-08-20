import { lazy, Suspense } from "react";
import { SectionTabs, type SectionTab } from "@shared/ui";
import { PageSkeleton } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";

const BandejaPage = lazy(() =>
  import("@features/bandeja/pages/bandeja-page").then((m) => ({ default: m.BandejaPage })),
);
const ContactsPage = lazy(() =>
  import("@features/contacts/pages/contacts-page").then((m) => ({ default: m.ContactsPage })),
);
const OpportunitiesPage = lazy(() =>
  import("@features/opportunities/pages/opportunities-page").then((m) => ({
    default: m.OpportunitiesPage,
  })),
);
const InteractionsPage = lazy(() =>
  import("@features/interactions/pages/interactions-page").then((m) => ({
    default: m.InteractionsPage,
  })),
);
const ClientInboxPage = lazy(() =>
  import("@features/client-chat/pages/client-inbox-page").then((m) => ({
    default: m.ClientInboxPage,
  })),
);
const EmailInboxPage = lazy(() =>
  import("@features/email/pages/email-inbox-page").then((m) => ({ default: m.EmailInboxPage })),
);
const AdminPropertiesPage = lazy(() =>
  import("@features/admin-properties/pages/admin-properties-page").then((m) => ({
    default: m.AdminPropertiesPage,
  })),
);

/**
 * CRM in one place: the inbox, the people, the deals, the history and the
 * portfolio. These were five sibling routes; nothing about them was separable
 * in the user's head, only in the router's.
 */
export function CrmSectionPage() {
  const { user } = useAuth();
  const scope = user?.adminScope ?? [];
  const allow = (s?: string) => !s || scope.length === 0 || scope.includes(s);

  const tabs: SectionTab[] = [
    { id: "bandeja", label: "Bandeja", scope: "crm", render: () => <BandejaPage /> },
    { id: "whatsapp", label: "WhatsApp", scope: "inbox", render: () => <ClientInboxPage /> },
    { id: "personas", label: "Personas", scope: "crm", render: () => <ContactsPage /> },
    {
      id: "oportunidades",
      label: "Oportunidades",
      scope: "crm",
      render: () => <OpportunitiesPage />,
    },
    {
      id: "interacciones",
      label: "Interacciones",
      scope: "crm",
      render: () => <InteractionsPage />,
    },
    { id: "propiedades", label: "Propiedades", render: () => <AdminPropertiesPage /> },
    { id: "correos", label: "Correos", scope: "email", render: () => <EmailInboxPage /> },
  ].filter((t) => allow(t.scope));

  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SectionTabs tabs={tabs} />
    </Suspense>
  );
}

export default CrmSectionPage;
