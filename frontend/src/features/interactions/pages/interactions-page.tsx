import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { InteractionsList } from "../components/interactions-list";

export function InteractionsPage() {
  return (
    <PageLayout width="lg">
      <PageHeader
        title="Interacciones"
        description="Historial de visitas, llamadas, reuniones y mensajes con los stakeholders."
      />
      <InteractionsList />
    </PageLayout>
  );
}
