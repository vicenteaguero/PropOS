import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExternalLink, FileText, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { SortControl } from "../components/sort-control";
import { sortDocuments, type SortMode } from "../lib/document-sort";
import { DocumentKindPill } from "../components/document-kind-pill";
import { NewDocumentActions } from "../components/fast-add-fab";
import { useDocuments } from "../hooks/use-documents";
import { formatBytes } from "@shared/lib/format";
import type { DocumentItem, ViewMode } from "../types";
import { ErrorState, ListShell } from "@shared/ui";
import { SearchInput } from "@shared/components/search-input/search-input";
import { formatDate } from "@shared/utils/format";

const VIEW_MODE_KEY = "documents:view-mode";
const GROUP_BY_KEY = "propos:documents-view";
const SORT_KEY = "documents:sort";

function loadViewMode(): ViewMode {
  // List, not grid. Contracts and mandates are text: as tiles they became a
  // wall of identical page glyphs whose names truncated after two words
  // ("Mandato de…", "Contrato de…"), with the file SIZE as the most prominent
  // thing on the card. A row shows the whole name and what it belongs to.
  if (typeof window === "undefined") return "list";
  return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "list";
}

function loadGroupBy(): GroupByMode {
  if (typeof window === "undefined") return "all";
  const raw = localStorage.getItem(GROUP_BY_KEY);
  if (raw === "property" || raw === "contact" || raw === "all") return raw;
  return "all";
}

function loadSort(): SortMode {
  if (typeof window === "undefined") return "recent";
  const raw = localStorage.getItem(SORT_KEY);
  if (raw === "recent" || raw === "created" || raw === "name" || raw === "priority") return raw;
  return "recent";
}

export function DocumentsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";
  const isDesktop = useIsDesktop();

  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [groupBy, setGroupBy] = useState<GroupByMode>(loadGroupBy);
  const [sort, setSort] = useState<SortMode>(loadSort);
  // Desktop master-detail selection — drives the right-hand preview pane.
  // Unused on mobile, where tapping a card navigates straight to the detail page.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = params.get("q") ?? "";
  const contactId = params.get("contact_id") ?? undefined;
  const propertyId = params.get("property_id") ?? undefined;
  const areaId = params.get("area_id") ?? undefined;

  const { data, isLoading, error, refetch } = useDocuments({
    contactId,
    propertyId,
    areaId,
    q: q || undefined,
  });

  // Sorting happens here rather than on the server: the whole tenant's
  // documents are already in hand, and a `sort=` param would fragment the query
  // cache into one entry per ordering of the same rows.
  const documents = useMemo(() => (data ? sortDocuments(data, sort) : undefined), [data, sort]);

  const selectedDoc = useMemo(
    () => documents?.find((d) => d.id === selectedId) ?? null,
    [documents, selectedId],
  );

  const setViewModePersist = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const setGroupByPersist = (mode: GroupByMode) => {
    setGroupBy(mode);
    localStorage.setItem(GROUP_BY_KEY, mode);
  };

  const setSortPersist = (mode: SortMode) => {
    setSort(mode);
    localStorage.setItem(SORT_KEY, mode);
  };

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

  // Functional update: reading `params` from the closure would drop any other
  // query param changed while the debounce was in flight.
  const onSearchChange = (next: string) =>
    setParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (next) sp.set("q", next);
      else sp.delete("q");
      return sp;
    });

  const searchField = (
    <SearchInput
      value={q}
      onChange={onSearchChange}
      className="lg:max-w-xl"
      ariaLabel="Buscar documentos"
      placeholder="Buscar por nombre..."
    />
  );

  const entityBanner = (contactId || propertyId || areaId) && (
    <div className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-[13px]">
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
      {/* Same columns and aspect as the real grid: they disagreed, so the
          layout jumped the moment the data landed. */}
      {isLoading && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {!isLoading && !error && documents && documents.length === 0 && (
        <EmptyState
          title="Sin documentos"
          description="Toca «Escanear» para capturar con la cámara o «Subir» para agregar un archivo."
        />
      )}

      {!isLoading &&
        documents &&
        documents.length > 0 &&
        (groupBy !== "all" ? (
          <DocumentsGrouped
            documents={documents}
            groupBy={groupBy}
            onOpen={openDocument}
            viewMode={viewMode}
          />
        ) : viewMode === "list" ? (
          <DocumentsList documents={documents} onOpen={openDocument} />
        ) : (
          <DocumentsGrid documents={documents} onOpen={openDocument} />
        ))}
    </>
  );

  // ---- Mobile (<lg): the shared list header, like every other list. ----
  //
  // This page used to hand-roll the same three parts in its own order — two
  // full-width action buttons, then the search, then the filters — which is
  // why it looked like a different product from Personas or Propiedades two
  // taps away. ListShell owns the geometry; the page supplies the parts.
  if (!isDesktop) {
    return (
      <PageLayout width="md" noPadding>
        <ListShell
          titleSr="Documentos"
          search={{
            value: q,
            onChange: onSearchChange,
            placeholder: "Buscar por nombre…",
            ariaLabel: "Buscar documentos",
          }}
          primaryAction={<NewDocumentActions compact />}
          filters={
            <div className="flex items-center gap-2">
              <GroupByToggle value={groupBy} onChange={setGroupByPersist} />
              <div className="min-w-0 flex-1">
                <SortControl value={sort} onChange={setSortPersist} />
              </div>
              <ViewModeToggle value={viewMode} onChange={setViewModePersist} />
            </div>
          }
          bodyPadding="page"
        >
          {entityBanner && <div className="mb-3">{entityBanner}</div>}
          {contentBody}
        </ListShell>
      </PageLayout>
    );
  }

  // ---- Desktop (lg+): master-detail — filter rail · grid · preview pane. ----
  return (
    <PageLayout width="app" noPadding>
      <div className="flex h-[calc(100dvh-var(--app-header-h,3.5rem)-var(--app-nav-h,0px)-var(--section-tabs-h,0px))] flex-col overflow-hidden">
        {/* One header row, then list and preview.
            The 17rem filter rail it replaces spent a whole column on four
            controls, clipped the search field, and pushed the third grouping
            chip off its own edge. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
          <div className="min-w-[12rem] flex-1">{searchField}</div>
          <GroupByToggle value={groupBy} onChange={setGroupByPersist} />
          <SortControl value={sort} onChange={setSortPersist} />
          <ViewModeToggle value={viewMode} onChange={setViewModePersist} />
          <NewDocumentActions />
        </div>
        {entityBanner && <div className="px-6 pt-3">{entityBanner}</div>}

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem] overflow-hidden">
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
          Selecciona un documento para ver su vista previa.
        </p>
      </div>
    );
  }

  const v = doc.current_version;
  const thumb = v?.thumbnail_url ?? null;

  return (
    <div className="flex h-full flex-col p-5">
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-secondary">
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

      <dl className="mt-4 divide-y divide-border overflow-hidden rounded-xl bg-card">
        <PreviewRow label="Origen" value={doc.origin} />
        <PreviewRow label="Creado" value={formatDate(doc.created_at)} />
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
