import { lazy, Suspense } from "react";
import { PageSkeleton, SectionTabs, type SectionTab } from "@shared/ui";

const DocumentsPage = lazy(() =>
  import("@features/documents/pages/documents-page").then((m) => ({ default: m.DocumentsPage })),
);
const PortalAdminPage = lazy(() =>
  import("@features/documents/pages/portal-admin-page").then((m) => ({
    default: m.PortalAdminPage,
  })),
);

/** Files and the public links used to collect them. */
export function DocumentsSectionPage() {
  const tabs: SectionTab[] = [
    { id: "archivos", label: "Archivos", render: () => <DocumentsPage /> },
    { id: "enlaces", label: "Enlaces", render: () => <PortalAdminPage /> },
  ];
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <SectionTabs tabs={tabs} />
    </Suspense>
  );
}

export default DocumentsSectionPage;
