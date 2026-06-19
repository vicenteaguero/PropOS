import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Folder, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@shared/components/page-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useAuth } from "@shared/hooks/use-auth";
import { ViewModeToggle } from "../components/view-mode-toggle";
import { DocumentsGrid } from "../components/documents-grid";
import { DocumentsList } from "../components/documents-list";
import { DocumentsGrouped } from "../components/documents-grouped";
import { GroupByToggle, type GroupByMode } from "../components/group-by-toggle";
import { NewDocumentActions } from "../components/fast-add-fab";
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

  // Local field state mirrors the URL `q` but debounces before pushing, so the
  // rounded search input feels instant without thrashing the query param.
  const [search, setSearch] = useState(q);

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

  // Debounce the field before writing it to the URL (300ms, matching the
  // previous SearchInput behavior) so typing doesn't thrash the query param.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params);
      if (search) sp.set("q", search);
      else sp.delete("q");
      setParams(sp);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Keep the field in sync when the URL changes externally (e.g. clearing the
  // entity filter rewrites the params).
  useEffect(() => {
    setSearch(q);
  }, [q]);

  const openDocument = (doc: DocumentItem) => {
    navigate(`/${role}/documents/${doc.id}`);
  };

  return (
    <PageLayout width="md">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[25px] font-bold leading-tight tracking-tight text-foreground">
            Documentos
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Gestiona contratos, escrituras y archivos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => navigate(`/${role}/documents/portals`)}
        >
          <Folder className="size-4" strokeWidth={1.8} /> Enlaces
        </Button>
      </div>

      {/* Primary actions */}
      <div className="mb-5">
        <NewDocumentActions />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.8}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre..."
          className="h-12 rounded-full border-line-strong pl-11 pr-11 text-[15px]"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Limpiar búsqueda"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <GroupByToggle value={groupBy} onChange={setGroupByPersist} />
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewModePersist} />
      </div>

      {(contactId || propertyId || areaId) && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-[13px]">
          <Folder className="size-4 text-muted-foreground" strokeWidth={1.8} />
          <span className="text-muted-foreground">Filtrando por entidad vinculada</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 rounded-full px-3 text-xs"
            onClick={() => setParams(new URLSearchParams(q ? { q } : {}))}
          >
            Limpiar
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
          Error al cargar documentos: {error instanceof Error ? error.message : "desconocido"}
        </div>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <EmptyState
          title="Sin documentos"
          description="Tocá «Escanear» para capturar con la cámara o «Subir» para agregar un archivo."
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
