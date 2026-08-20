import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ErrorState, PageSkeleton, Pill, ResponsiveTable, type ResponsiveColumn } from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import {
  useAdminUsersList,
  type AdminUserListItem,
} from "@features/admin-users/hooks/use-admin-users";
import { useAuth } from "@shared/hooks/use-auth";
import { InviteUserDrawer } from "@features/admin-users/components/invite-user-drawer";
import { initials } from "@shared/utils/format";
import { SearchInput } from "@shared/components/search-input/search-input";

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
  const loadingBlock = isLoading && <PageSkeleton variant={isDesktop ? "table" : "list"} />;

  const errorBlock = error && (
    <ErrorState
      message="No pudimos cargar los usuarios."
      onRetry={() => refetch()}
      className="mx-5 lg:mx-8"
    />
  );

  const emptyBlock = !isLoading && !error && users.length === 0 && (
    <div className="px-5 lg:px-8">
      <EmptyState
        title="Sin usuarios"
        description="Invita al primer usuario de la plataforma."
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
          <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-foreground">
            Usuarios
          </h1>
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
        <SearchInput
          value={search}
          onChange={setSearch}
          ariaLabel="Buscar usuarios"
          placeholder="Buscar por email, nombre o RUT"
          debounceMs={0}
          className="lg:max-w-md"
        />
      </div>

      {loadingBlock}
      {errorBlock}
      {emptyBlock}

      {!isLoading && !error && users.length > 0 && (
        <ResponsiveTable
          className="lg:mx-8"
          rows={users}
          rowKey={(u) => u.id}
          onRowClick={(u) => openUser(u.id)}
          columns={
            [
              {
                key: "usuario",
                header: "Usuario",
                cell: (u) => (
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
                ),
              },
              {
                key: "rut",
                header: "RUT",
                className: "tabular-nums text-muted-foreground",
                cell: (u) => u.rut ?? "—",
              },
              { key: "rol", header: "Rol", cell: (u) => <Pill tone="neutral">{u.role}</Pill> },
              {
                key: "vista",
                header: "Vista",
                className: "text-muted-foreground",
                cell: (u) => u.view,
              },
              {
                key: "estado",
                header: "Estado",
                cell: (u) =>
                  u.is_active ? (
                    <span className="text-[13px] text-muted-foreground">Activo</span>
                  ) : (
                    <Pill tone="destructive">Deshabilitado</Pill>
                  ),
              },
              {
                key: "creado",
                header: "Creado",
                className: "tabular-nums text-muted-foreground",
                cell: (u) =>
                  new Date(u.created_at).toLocaleDateString("es-CL", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }),
              },
            ] as ResponsiveColumn<AdminUserListItem>[]
          }
          mobileRow={(u: AdminUserListItem) => ({
            left: (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                {initials(u.full_name || u.email)}
              </span>
            ),
            title: (
              <span className="flex items-center gap-2">
                <span className="truncate">{u.full_name || "(sin nombre)"}</span>
                {u.is_dev_admin && <Pill tone="warning">DEV</Pill>}
                {!u.is_active && <Pill tone="destructive">Deshabilitado</Pill>}
              </span>
            ),
            sub: u.email,
            right: <Pill tone="neutral">{u.role}</Pill>,
          })}
        />
      )}

      <InviteUserDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentTenantId={user?.tenantId}
      />
    </PageLayout>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default AdminUsersPage;
