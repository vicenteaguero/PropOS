import { PageLayout } from "@shared/components/page-layout";
import { useIsDesktop } from "@/hooks/use-mobile";
import { InteractionsList } from "../components/interactions-list";

export function InteractionsPage() {
  const isDesktop = useIsDesktop();

  // Desktop: full-width app surface so the dense interactions table uses the
  // whole width. Mobile: capped reading column (unchanged).
  return (
    <PageLayout width={isDesktop ? "app" : "lg"}>
      <InteractionsList />
    </PageLayout>
  );
}
