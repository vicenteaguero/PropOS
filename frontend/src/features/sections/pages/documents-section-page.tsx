import { lazy, Suspense } from "react";
import { PageSkeleton, SectionTabs, WipState, type SectionTab } from "@shared/ui";

const DocumentsPage = lazy(() =>
  import("@features/documents/pages/documents-page").then((m) => ({ default: m.DocumentsPage })),
);
/** Files and the public links used to collect them. */
export function DocumentsSectionPage() {
  const tabs: SectionTab[] = [
    {
      id: "documentos",
      // "Archivos" inside a section already called Documentos was the same word
      // twice, and the tab is what people name the thing when they talk about
      // it. `aliases` keeps every `?tab=archivos` link and redirect working.
      label: "Documentos",
      aliases: ["archivos"],
      feature: "documents",
      render: () => <DocumentsPage />,
    },
    {
      id: "enlaces",
      label: "Enlaces",
      feature: "portales",
      // The admin screen behind this is half-built: a form, a QR dialog and a
      // review queue that together do not yet make a working flow, which read
      // as a broken feature rather than an unfinished one. The page itself is
      // untouched and still routable — `/s/{slug}` and the public portal keep
      // working — it just does not greet anyone from here.
      render: () => (
        <WipState
          title="Enlaces para pedir documentos"
          description="Acá vas a poder crear un enlace y mandárselo a un cliente, a un banco o a una notaría para que suban documentos sin tener cuenta en PropOS. Los archivos te llegan directo a esta sección. Todavía lo estamos terminando."
        />
      ),
    },
  ];
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SectionTabs tabs={tabs} />
    </Suspense>
  );
}

export default DocumentsSectionPage;
