import { PropertyList } from "@features/properties/components/property-list/property-list";

interface PropertiesPageProps {
  basePath: string;
}

export function PropertiesPage({ basePath }: PropertiesPageProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Propiedades</h1>
      </div>
      <PropertyList basePath={basePath} />
    </div>
  );
}
