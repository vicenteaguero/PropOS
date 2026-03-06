import { TopBar } from "@shared/components/top-bar/top-bar";
import { PropertyList } from "@features/properties/components/property-list/property-list";

const PAGE_TITLE = "Propiedades";

interface PropertiesPageProps {
  basePath: string;
}

export function PropertiesPage({ basePath }: PropertiesPageProps) {
  return (
    <div className="flex flex-col">
      <TopBar title={PAGE_TITLE} />
      <PropertyList basePath={basePath} />
    </div>
  );
}
