import { lazy, Suspense } from "react";
import { PageSkeleton, SectionTabs, type SectionTab } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";

const FinancePage = lazy(() =>
  import("@features/finance/pages/finance-page").then((m) => ({ default: m.FinancePage })),
);
const AnalyticsPage = lazy(() =>
  import("@features/analytics/pages/analytics-page").then((m) => ({ default: m.AnalyticsPage })),
);
const AgentCostPage = lazy(() =>
  import("@features/analytics/pages/agent-cost-page").then((m) => ({ default: m.AgentCostPage })),
);
const UsagePage = lazy(() =>
  import("@features/analytics/pages/usage-page").then((m) => ({ default: m.UsagePage })),
);

/** Money in one place: movements, the numbers behind them, and what the AI costs. */
export function FinanceSectionPage() {
  const { user } = useAuth();
  const scope = user?.adminScope ?? [];
  const allow = (s?: string) => !s || scope.length === 0 || scope.includes(s);
  const isDevAdmin = user?.view === "admin-dev";

  const tabs: SectionTab[] = [
    {
      id: "movimientos",
      label: "Movimientos",
      scope: "finanzas",
      feature: "finanzas",
      render: () => <FinancePage />,
    },
    {
      id: "analitica",
      label: "Analítica",
      scope: "analytics",
      feature: "analytics",
      render: () => <AnalyticsPage />,
    },
    ...(isDevAdmin
      ? [
          {
            id: "costo-propo",
            label: "Costo Propo",
            scope: "analytics",
            feature: "analytics",
            render: () => <AgentCostPage />,
          },
          {
            // Who used the app, for how long, and what the always-warm instance
            // cost while they did. Dev-admin only: it names people.
            id: "uso",
            label: "Uso",
            feature: "uso",
            render: () => <UsagePage />,
          },
        ]
      : []),
  ].filter((t) => allow(t.scope));

  return (
    <Suspense fallback={<PageSkeleton variant="kpi-grid" />}>
      <SectionTabs tabs={tabs} />
    </Suspense>
  );
}

export default FinanceSectionPage;
