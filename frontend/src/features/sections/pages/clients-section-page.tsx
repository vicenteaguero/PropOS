import { lazy, Suspense } from "react";
import { PageSkeleton, SectionTabs, type SectionTab } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import type { InboxChannel } from "@features/attention/pages/attention-page";

const AttentionPage = lazy(() =>
  import("@features/attention/pages/attention-page").then((m) => ({ default: m.AttentionPage })),
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
 * Clientes — four tabs because the business has four irreducible entities, and
 * everything else is a relationship between them: the conversation, the person
 * it is with, the deal it is about, and the property it is for.
 *
 * It was seven tabs called CRM. `WhatsApp` and `Correos` were the same screen
 * twice, split by transport rather than by anything a broker cares about;
 * `Oportunidades` and `Interacciones` were lists of rows that only mean
 * something attached to a person. What is left is the entity list.
 *
 * Conversaciones leads because it is where the data actually enters the system:
 * the broker talks, and the record follows. The cross-source queue that used to
 * open this section ("Atención") moved to Inicio, which is where "what do I do
 * now" belongs — this tab answers the narrower "who is waiting on me".
 */
export function ClientsSectionPage() {
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

  // Two headline tabs, not four. See SectionTab.secondary: Personas and
  // Propiedades are catalogues reached from the two views a broker actually
  // opens the section for, and each of those views carries a button to its own.
  const tabs: SectionTab[] = [
    ...(channels.length > 0
      ? [
          {
            id: "conversaciones",
            label: "Conversaciones",
            feature: "conversaciones",
            // Every path this tab has ever had. The inbox was `whatsapp` and
            // `correos` before it merged, `bandeja` before it grew the ranked
            // queue, and `atencion` while it held one; push notifications and
            // bookmarks still carry all four.
            aliases: ["atencion", "bandeja", "whatsapp", "correos"],
            render: () => <AttentionPage channels={channels} />,
          },
        ]
      : []),
    {
      id: "personas",
      label: "Personas",
      scope: "crm",
      feature: "crm",
      secondary: true,
      // Interacciones lived here as its own tab; its links now open the person.
      aliases: ["interacciones"],
      render: () => <ContactsPage />,
    },
    {
      id: "negocios",
      label: "Negocios",
      scope: "crm",
      feature: "crm",
      aliases: ["pipeline", "oportunidades"],
      render: () => <OpportunitiesPage />,
    },
    {
      id: "propiedades",
      label: "Propiedades",
      feature: "propiedades",
      secondary: true,
      render: () => <AdminPropertiesPage />,
    },
  ].filter((t) => allow(t.scope));

  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SectionTabs tabs={tabs} />
    </Suspense>
  );
}

export default ClientsSectionPage;
