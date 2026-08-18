import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Pill, Row } from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import {
  useAdminUsersList,
  type AdminUserListItem,
} from "@features/admin-users/hooks/use-admin-users";
import { useAuth } from "@shared/hooks/use-auth";
import { InviteUserDrawer } from "@features/admin-users/components/invite-user-drawer";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AdminUsersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filters = useMemo(() => ({ search: search || undefined }), [search]);
  const { data, isLoading, error, refetch } = useAdminUsersList(filters);
  const users = data ?? [];

  const openUser = (id: string) => navigate(`/admin/users/${id}`);

  // Shared states (loading / error / empty) — identical on both layouts.
  const loadingBlock = isLoading && (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );

  const errorBlock = error && (
    <div className="mx-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive lg:mx-8">
      No pudimos cargar los usuarios.
      <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
        Reintentar
      </Button>
    </div>
  );

  const emptyBlock = !isLoading && !error && users.length === 0 && (
    <div className="px-5 lg:px-8">
      <EmptyState
        title="Sin usuarios"
        description="Invitá al primer usuario de la plataforma."
        actionLabel="Invitar usuario"
        onAction={() => setInviteOpen(true)}
      />
    </div>
  );

  return (
    <PageLayout width="md" noPadding className="pb-6 lg:max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 lg:px-8 lg:pt-7">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Usuarios
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {data ? `${users.length} usuarios` : "Usuarios de la plataforma"}
          </p>
        </div>
        {/* Mobile: round + button. Desktop: labeled button. */}
        <Button
          variant="ink"
          size="icon-lg"
          className="rounded-full lg:hidden"
          aria-label="Invitar usuario"
          onClick={() => setInviteOpen(true)}
        >
          <Plus className="size-5" strokeWidth={1.8} />
        </Button>
        <Button
          variant="ink"
          className="hidden gap-2 lg:inline-flex"
          onClick={() => setInviteOpen(true)}
        >
          <Plus className="size-4" strokeWidth={1.8} />
          Invitar usuario
        </Button>
      </div>

      {/* Search */}
      <div className="px-5 pb-4 lg:px-8 lg:pb-5">
        <div className="relative lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.8}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email, nombre o RUT"
            className="h-12 w-full rounded-full border border-border bg-secondary pl-11 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-line-strong focus-visible:outline-none"
          />
        </div>
      </div>

      {loadingBlock}
      {errorBlock}
      {emptyBlock}

      {/* Mobile: tappable rows (unchanged). */}
      {!isLoading && !error && users.length > 0 && !isDesktop && (
        <div className="lg:hidden">
          {users.map((u, i) => (
            <Row
              key={u.id}
              onClick={() => openUser(u.id)}
              divider={i < users.length - 1}
              left={
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                  {initials(u.full_name || u.email)}
                </span>
              }
              title={
                <span className="flex items-center gap-2">
                  <span className="truncate">{u.full_name || "(sin nombre)"}</span>
                  {u.is_dev_admin && <Pill tone="warning">DEV</Pill>}
                  {!u.is_active && <Pill tone="destructive">Deshabilitado</Pill>}
                </span>
              }
              sub={u.email}
              right={<Pill tone="neutral">{u.role}</Pill>}
            />
          ))}
        </div>
      )}

      {/* Desktop: dense table using the full width. */}
      {!isLoading && !error && users.length > 0 && isDesktop && (
        <div className="px-8">
          <UsersTable users={users} onOpen={openUser} />
        </div>
      )}

      <InviteUserDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentTenantId={user?.tenantId}
      />
    </PageLayout>
  );
}

/** Desktop-only dense user table. Rows navigate to the detail page on click. */
function UsersTable({
  users,
  onOpen,
}: {
  users: AdminUserListItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[12px] font-medium text-muted-foreground">
            <th className="py-2.5 pl-4 pr-3 font-medium">Usuario</th>
            <th className="px-3 py-2.5 font-medium">RUT</th>
            <th className="px-3 py-2.5 font-medium">Rol</th>
            <th className="px-3 py-2.5 font-medium">Vista</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
            <th className="px-3 py-2.5 font-medium">Creado</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr
              key={u.id}
              onClick={() => onOpen(u.id)}
              className={`cursor-pointer align-middle transition hover:bg-secondary/40 ${
                i < users.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <td className="py-2.5 pl-4 pr-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-foreground">
                    {initials(u.full_name || u.email)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">
                        {u.full_name || "(sin nombre)"}
                      </span>
                      {u.is_dev_admin && <Pill tone="warning">DEV</Pill>}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {u.email}
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{u.rut ?? "—"}</td>
              <td className="px-3 py-2.5">
                <Pill tone="neutral">{u.role}</Pill>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{u.view}</td>
              <td className="px-3 py-2.5">
                {u.is_active ? (
                  <span className="text-[13px] text-muted-foreground">Activo</span>
                ) : (
                  <Pill tone="destructive">Deshabilitado</Pill>
                )}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString("es-CL", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default AdminUsersPage;
