/**
 * Route path → the module that renders it, for prefetching on intent.
 *
 * Every page in this app is `React.lazy`, so the first tap on a destination
 * pays a chunk download before anything can render — and until now nothing
 * prefetched them except two warms in `core/query/warmup.tsx`. Opening the
 * "Más" sheet, or hovering a sidebar entry, is an unambiguous signal that one
 * of these is about to be needed, and the download costs nothing while the
 * broker is still deciding.
 *
 * The importer functions are the SAME specifiers the router uses, so Vite emits
 * one chunk per page and this warms the module cache the router will read.
 *
 * Keyed by the path WITHOUT the role prefix (`/admin`, `/agent`, …), since the
 * same page serves every role.
 */
const CHUNKS: Record<string, () => Promise<unknown>> = {
  "": () => import("@features/home/pages/admin-home-page"),
  clientes: () => import("@features/sections/pages/clients-section-page"),
  agenda: () => import("@features/sections/pages/agenda-section-page"),
  finanzas: () => import("@features/sections/pages/finance-section-page"),
  documentos: () => import("@features/sections/pages/documents-section-page"),
  pendientes: () => import("@features/pending/pages/pending-page"),
  agent: () => import("@features/agent/pages/agent-chat-page"),
  settings: () => import("@features/settings/pages/settings-page"),
  "settings/clientes": () => import("@features/settings/pages/clients-catalogs-page"),
  "settings/propo": () => import("@features/settings/pages/agent-policies-page"),
  users: () => import("@features/admin-users/pages/admin-users-page"),
  visitantes: () =>
    import("@features/admin-visitor-invitations/pages/admin-visitor-invitations-page"),
  phones: () => import("@features/admin-phones/pages/admin-phones-page"),
  workflows: () => import("@features/workflows/pages/workflows-page"),
  tenants: () => import("@features/admin-tenants/pages/admin-tenants-page"),
  "datos/importar": () => import("@features/data-admin/pages/import-page"),
};

const started = new Set<string>();

/**
 * Start downloading the chunk behind a path. Idempotent and fire-and-forget:
 * a failed prefetch must never surface, because the real navigation will retry
 * it and report properly.
 */
export function prefetchRoute(path: string): void {
  const key = routeKey(path);
  if (key === null || started.has(key)) return;
  const load = CHUNKS[key];
  if (!load) return;
  started.add(key);
  void load().catch(() => started.delete(key));
}

/** `/admin/settings/clientes?tab=x` → `settings/clientes`. */
function routeKey(path: string): string | null {
  const clean = path.split("?")[0] ?? path;
  const parts = clean.split("/").filter(Boolean);
  // Drop the role segment; everything else is the page.
  return parts.slice(1).join("/");
}
