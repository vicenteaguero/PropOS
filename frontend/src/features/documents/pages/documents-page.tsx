import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Folder, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { SearchInput } from "@shared/components/search-input/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useAuth } from "@shared/hooks/use-auth";
import { ViewModeToggle } from "../components/view-mode-toggle";
import { DocumentsGrid } from "../components/documents-grid";
import { DocumentsList } from "../components/documents-list";
import { DocumentsGrouped } from "../components/documents-grouped";
import { GroupByToggle, type GroupByMode } from "../components/group-by-toggle";
import { NewDocumentButton } from "../components/fast-add-fab";
import { useDocuments } from "../hooks/use-documents";
import type { DocumentItem, ViewMode } from "../types";

const VIEW_MODE_KEY = "documents:view-mode";
const GROUP_BY_KEY = "propos:documents-view";

function loadViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "grid";
}

function loadGroupBy(): GroupByMode {
  if (typeof window === "undefined") return "all";
  const raw = localStorage.getItem(GROUP_BY_KEY);
  if (raw === "property" || raw === "contact" || raw === "all") return raw;
  return "all";
}

export function DocumentsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [groupBy, setGroupBy] = useState<GroupByMode>(loadGroupBy);

  const q = params.get("q") ?? "";
  const contactId = params.get("contact_id") ?? undefined;
  const propertyId = params.get("property_id") ?? undefined;
  const areaId = params.get("area_id") ?? undefined;

  const { data, isLoading, error } = useDocuments({
    contactId,
    propertyId,
    areaId,
    q: q || undefined,
  });

  const setViewModePersist = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const setGroupByPersist = (mode: GroupByMode) => {
    setGroupBy(mode);
    localStorage.setItem(GROUP_BY_KEY, mode);
  };

  const setQuery = (next: string) => {
    const sp = new URLSearchParams(params);
    if (next) sp.set("q", next);
    else sp.delete("q");
    setParams(sp);
  };

  const openDocument = (doc: DocumentItem) => {
    navigate(`/${role}/documents/${doc.id}`);
  };

  return (
    <PageLayout width="xl">
      <PageHeader
        title="Documentos"
        description="Gestiona contratos, escrituras y archivos"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/${role}/documents/portals`)}
            >
              <Folder className="size-4" /> Enlaces de subida
            </Button>
            <NewDocumentButton />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[240px] flex-1">
          <SearchInput value={q} onChange={setQuery} placeholder="Buscar por nombre..." />
        </div>
        <GroupByToggle value={groupBy} onChange={setGroupByPersist} />
        <ViewModeToggle value={viewMode} onChange={setViewModePersist} />
      </div>

      {(contactId || propertyId || areaId) && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
          <Settings className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Filtrando por entidad vinculada</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 text-xs"
            onClick={() => setParams(new URLSearchParams(q ? { q } : {}))}
          >
            Limpiar
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] w-full rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Error al cargar documentos: {error instanceof Error ? error.message : "desconocido"}
        </div>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <EmptyState
          title="Sin documentos"
          description="Tocá «Nuevo documento» para escanear con la cámara o subir un archivo."
        />
      )}

      {!isLoading &&
        data &&
        data.length > 0 &&
        (viewMode === "list" ? (
          <DocumentsList documents={data} onOpen={openDocument} />
        ) : groupBy === "all" ? (
          <DocumentsGrid documents={data} onOpen={openDocument} />
        ) : (
          <DocumentsGrouped documents={data} groupBy={groupBy} onOpen={openDocument} />
        ))}
    </PageLayout>
  );
}
