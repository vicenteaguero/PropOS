import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, Columns3 } from "lucide-react";
import { PropertyList } from "@features/properties/components/property-list/property-list";
import { PropertyKanban } from "@features/properties/components/property-kanban/property-kanban";
import { PropertyFilters } from "@features/properties/components/property-filters/property-filters";
import { PageHeader } from "@shared/components/page-header/page-header";
import { SearchInput } from "@shared/components/search-input/search-input";
import type { PropertyStatus } from "@features/properties/types";

interface PropertiesPageProps {
  basePath: string;
}

type ViewMode = "grid" | "kanban";

const STORAGE_KEY = "propos-properties-view";

function getInitialView(): ViewMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "kanban" ? "kanban" : "grid";
}

const VALID_STATUSES = new Set<string>(["AVAILABLE", "RESERVED", "SOLD", "INACTIVE"]);

function parseStatusFilter(params: URLSearchParams): PropertyStatus[] {
  const raw = params.get("status");
  if (!raw) return [];
  return raw
    .split(",")
    .filter((s) => VALID_STATUSES.has(s)) as PropertyStatus[];
}

export function PropertiesPage({ basePath }: PropertiesPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialView);

  const searchQuery = searchParams.get("q") ?? "";
  const statusFilter = parseStatusFilter(searchParams);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set("q", value);
        } else {
          next.delete("q");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const handleStatusChange = useCallback(
    (statuses: PropertyStatus[]) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (statuses.length > 0) {
          next.set("status", statuses.join(","));
        } else {
          next.delete("status");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  function toggleView(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader
        title="Propiedades"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border">
              <button
                type="button"
                onClick={() => toggleView("grid")}
                className={`p-1.5 ${viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"} rounded-l-md`}
                title="Vista de cuadricula"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => toggleView("kanban")}
                className={`p-1.5 ${viewMode === "kanban" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"} rounded-r-md`}
                title="Vista Kanban"
              >
                <Columns3 className="size-4" />
              </button>
            </div>
            <SearchInput
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Buscar propiedades..."
              className="w-48 sm:w-64"
            />
          </div>
        }
      />
      <PropertyFilters selected={statusFilter} onChange={handleStatusChange} />
      {viewMode === "grid" ? (
        <PropertyList
          basePath={basePath}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
        />
      ) : (
        <PropertyKanban
          searchQuery={searchQuery}
          statusFilter={statusFilter}
        />
      )}
    </div>
  );
}
