import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnitaInlineProposalCard } from "@features/anita/components/anita-inline-proposal-card";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { usePendingProposals } from "../hooks/use-pending";
import { Loader2 } from "lucide-react";

const TABS = [
  { value: "pending", label: "Pendientes" },
  { value: "accepted", label: "Aceptados" },
  { value: "rejected", label: "Rechazados" },
];

export function PendingPage() {
  const [tab, setTab] = useState<string>("pending");
  const { data, isLoading, isError } = usePendingProposals(tab);

  return (
    <PageLayout width="md">
      <PageHeader
        title="Pendientes de Anita"
        description="Revisa y acepta las propuestas que Anita generó desde audio o chat."
      />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={tab === t.value ? "default" : "outline"}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {isError && <Card className="p-4 text-destructive">No pude cargar la lista.</Card>}
        {!isLoading && !isError && (data?.length ?? 0) === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <Badge variant="outline" className="mb-2">
              Vacío
            </Badge>
            <p>
              No hay propuestas{" "}
              {tab === "pending" ? "pendientes" : tab === "accepted" ? "aceptadas" : "rechazadas"}.
            </p>
          </Card>
        )}

        <div className="space-y-3">
          {data?.map((p) => (
            <AnitaInlineProposalCard key={p.id} proposalId={p.id} />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
