import { lazy, Suspense } from "react";
import { PageSkeleton, SectionTabs, type SectionTab } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import type { InboxChannel } from "@features/bandeja/pages/bandeja-page";

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
const AdminPropertiesPage = lazy(() =>
  import("@features/admin-properties/pages/admin-properties-page").then((m) => ({
    default: m.AdminPropertiesPage,
  })),
);

/**
 * CRM in four tabs: what is waiting, who it is waiting on, what it is worth,
 * and what we are selling.
 *
 * It was seven. `WhatsApp` and `Correos` were the same screen twice, split by
 * transport rather than by anything the broker cares about, so they collapsed
 * into `Bandeja` with a channel filter. `Oportunidades` and `Interacciones`
 * were lists of rows that only mean something attached to a person — a bare
 * "Llamada · 14 mar" is unreadable — so they moved inside the person's detail,
 * which is where you go looking for them anyway.
 */
export function CrmSectionPage() {
  const { user } = useAuth();
  const scope = user?.adminScope ?? [];
  // An empty scope is full admin; otherwise the scope list is a whitelist.
  const allow = (s?: string) => !s || scope.length === 0 || scope.includes(s);

  // Bandeja survives if EITHER channel is permitted, and shows only that one.
  // Gating the whole tab on both would hide the inbox from an inbox-only user.
  const channels: InboxChannel[] = [
    ...(allow("inbox") ? (["whatsapp"] as const) : []),
    ...(allow("email") ? (["email"] as const) : []),
  ];

  const tabs: SectionTab[] = [
    ...(channels.length > 0
      ? [
          {
            id: "bandeja",
            label: "Bandeja",
            aliases: ["whatsapp", "correos"],
            render: () => <BandejaPage channels={channels} />,
          },
        ]
      : []),
    {
      id: "personas",
      label: "Personas",
      scope: "crm",
      // Interacciones lived here as its own tab; its links now open the person.
      aliases: ["interacciones"],
      render: () => <ContactsPage />,
    },
    {
      id: "pipeline",
      label: "Negocios",
      scope: "crm",
      aliases: ["oportunidades"],
      render: () => <OpportunitiesPage />,
    },
    { id: "propiedades", label: "Propiedades", render: () => <AdminPropertiesPage /> },
  ].filter((t) => allow(t.scope));

  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SectionTabs tabs={tabs} />
    </Suspense>
  );
}

export default CrmSectionPage;
