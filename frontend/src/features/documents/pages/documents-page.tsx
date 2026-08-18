import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExternalLink, FileText, Folder, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@shared/components/page-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useAuth } from "@shared/hooks/use-auth";
import { useIsDesktop } from "@/hooks/use-mobile";
import { ViewModeToggle } from "../components/view-mode-toggle";
import { DocumentsGrid } from "../components/documents-grid";
import { DocumentsList } from "../components/documents-list";
import { DocumentsGrouped } from "../components/documents-grouped";
import { GroupByToggle, type GroupByMode } from "../components/group-by-toggle";
import { DocumentKindPill } from "../components/document-kind-pill";
import { NewDocumentActions } from "../components/fast-add-fab";
import { useDocuments } from "../hooks/use-documents";
import { formatBytes } from "@shared/lib/format";
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
  const isDesktop = useIsDesktop();

  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [groupBy, setGroupBy] = useState<GroupByMode>(loadGroupBy);
  // Desktop master-detail selection — drives the right-hand preview pane.
  // Unused on mobile, where tapping a card navigates straight to the detail page.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = params.get("q") ?? "";
  const contactId = params.get("contact_id") ?? undefined;
  const propertyId = params.get("property_id") ?? undefined;
  const areaId = params.get("area_id") ?? undefined;

  // Local field state mirrors the URL `q` but debounces before pushing, so the
  // rounded search input feels instant without thrashing the query param.
  const [search, setSearch] = useState(q);

  const { data, isLoading, error, refetch } = useDocuments({
    contactId,
    propertyId,
    areaId,
    q: q || undefined,
  });

  const selectedDoc = useMemo(
    () => data?.find((d) => d.id === selectedId) ?? null,
    [data, selectedId],
  );

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

  // Mobile: tapping a card opens the full detail page (unchanged behavior).
  // Desktop: selecting a card fills the preview pane; the pane's CTA navigates.
  const openDocument = (doc: DocumentItem) => {
    if (isDesktop) {
      setSelectedId(doc.id);
      return;
    }
    navigate(`/${role}/documents/${doc.id}`);
  };

  const goToDocument = (id: string) => navigate(`/${role}/documents/${id}`);

  const searchField = (
    <div className="relative">
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
  );

  const entityBanner = (contactId || propertyId || areaId) && (
    <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-[13px]">
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
  );

  // States + the grid/list/grouped body, shared by mobile flow and desktop pane.
  const contentBody = (
    <>
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
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
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Error al cargar documentos: {error instanceof Error ? error.message : "desconocido"}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
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
    </>
  );

  // ---- Mobile (<lg): the original single-column layout, unchanged. ----
  if (!isDesktop) {
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
        <div className="mb-4">{searchField}</div>

        {/* Filters */}
        <div className="mb-4 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <GroupByToggle value={groupBy} onChange={setGroupByPersist} />
          </div>
          <ViewModeToggle value={viewMode} onChange={setViewModePersist} />
        </div>

        {entityBanner && <div className="mb-3">{entityBanner}</div>}

        {contentBody}
      </PageLayout>
    );
  }

  // ---- Desktop (lg+): master-detail — filter rail · grid · preview pane. ----
  return (
    <PageLayout width="app" noPadding>
      <div className="flex h-[calc(100dvh-var(--app-header-h,3.5rem)-var(--app-nav-h,0px))] flex-col overflow-hidden">
        {/* Top bar: title + Enlaces */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-8 py-5">
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

        <div className="grid min-h-0 flex-1 grid-cols-[17rem_minmax(0,1fr)_22rem] overflow-hidden">
          {/* Filter rail */}
          <aside className="min-h-0 space-y-5 overflow-y-auto border-r border-border p-5">
            <NewDocumentActions />
            {searchField}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Agrupar
              </p>
              <GroupByToggle value={groupBy} onChange={setGroupByPersist} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Vista
              </p>
              <ViewModeToggle value={viewMode} onChange={setViewModePersist} />
            </div>
            {entityBanner}
          </aside>

          {/* Grid / list pane */}
          <section className="min-h-0 overflow-y-auto p-6">{contentBody}</section>

          {/* Preview pane */}
          <aside className="min-h-0 overflow-y-auto border-l border-border">
            <DocumentPreviewPane doc={selectedDoc} onOpen={goToDocument} />
          </aside>
        </div>
      </div>
    </PageLayout>
  );
}

/** Lightweight desktop preview: thumbnail + meta + CTA into the full detail page. */
function DocumentPreviewPane({
  doc,
  onOpen,
}: {
  doc: DocumentItem | null;
  onOpen: (id: string) => void;
}) {
  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <FileText className="size-10 text-muted-foreground/40" strokeWidth={1.25} />
        <p className="text-sm text-muted-foreground">
          Seleccioná un documento para ver su vista previa.
        </p>
      </div>
    );
  }

  const v = doc.current_version;
  const thumb = v?.thumbnail_url ?? null;

  return (
    <div className="flex h-full flex-col p-5">
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl bg-secondary">
        {thumb ? (
          <img
            src={thumb}
            alt={doc.display_name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <FileText className="size-14 text-muted-foreground" strokeWidth={1.3} />
        )}
      </div>

      <h2 className="mt-4 text-[17px] font-semibold leading-snug text-foreground">
        {doc.display_name}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <DocumentKindPill doc={doc} />
        {v && <span className="text-xs text-muted-foreground">v{v.version_number}</span>}
        {v?.size_bytes ? (
          <span className="text-xs text-muted-foreground">· {formatBytes(v.size_bytes)}</span>
        ) : null}
      </div>

      <dl className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-card">
        <PreviewRow label="Origen" value={doc.origin} />
        <PreviewRow label="Creado" value={new Date(doc.created_at).toLocaleDateString("es-CL")} />
        {doc.assignments && doc.assignments.length > 0 && (
          <PreviewRow label="Vínculos" value={`${doc.assignments.length}`} />
        )}
      </dl>

      <Button className="mt-4 w-full gap-2" onClick={() => onOpen(doc.id)}>
        <ExternalLink className="size-4" strokeWidth={1.8} /> Abrir documento
      </Button>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-foreground">{value}</dd>
    </div>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default DocumentsPage;
