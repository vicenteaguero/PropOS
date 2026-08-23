import { lazy, Suspense } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { PageSkeleton, SectionTabs, type SectionTab } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import type { InboxChannel } from "@features/attention/pages/attention-page";

const AttentionPage = lazy(() =>
  import("@features/attention/pages/attention-page").then((m) => ({ default: m.AttentionPage })),
);
const OpportunitiesPage = lazy(() =>
  import("@features/opportunities/pages/opportunities-page").then((m) => ({
    default: m.OpportunitiesPage,
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
  const [params] = useSearchParams();
  const role = (user?.role ?? "ADMIN").toLowerCase();
  const scope = user?.adminScope ?? [];
  // An empty scope is full admin; otherwise the scope list is a whitelist.
  const allow = (s?: string) => !s || scope.length === 0 || scope.includes(s);

  // Bandeja survives if EITHER channel is permitted, and shows only that one.
  // Gating the whole tab on both would hide the inbox from an inbox-only user.
  const channels: InboxChannel[] = [
    ...(allow("inbox") ? (["whatsapp"] as const) : []),
    ...(allow("email") ? (["email"] as const) : []),
  ];

  // Two tabs. Personas and Propiedades used to be `secondary` tabs here —
  // present in the bar only while open — which meant the button that opened
  // one INJECTED a tab that had not been there a moment earlier, and closing
  // it meant tapping a different tab. They are their own routes now
  // (`/:role/personas`, `/:role/propiedades`), so the topbar gives them a back
  // arrow like every other destination and the bar stops changing shape.
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
      id: "negocios",
      label: "Negocios",
      scope: "crm",
      feature: "crm",
      aliases: ["pipeline", "oportunidades"],
      render: () => <OpportunitiesPage />,
    },
  ].filter((t) => allow(t.scope));

  // Links and push notifications still carry `?tab=personas`. Sending them to
  // the tab that no longer exists would silently land on Conversaciones.
  const legacyTab = params.get("tab");
  if (legacyTab === "personas" || legacyTab === "interacciones")
    return <Navigate to={`/${role}/personas`} replace />;
  if (legacyTab === "propiedades") return <Navigate to={`/${role}/propiedades`} replace />;

  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SectionTabs tabs={tabs} />
    </Suspense>
  );
}

export default ClientsSectionPage;
