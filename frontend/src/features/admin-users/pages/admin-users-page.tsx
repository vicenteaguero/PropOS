import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { label } from "@shared/lib/labels";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  CONTROL_SQUARE,
  ErrorState,
  ListShell,
  PageSkeleton,
  Pill,
  ResponsiveTable,
  type ResponsiveColumn,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import {
  useAdminUsersList,
  type AdminUserListItem,
} from "@features/admin-users/hooks/use-admin-users";
import { useAuth } from "@shared/hooks/use-auth";
import { InviteUserDrawer } from "@features/admin-users/components/invite-user-drawer";
import { initials } from "@shared/utils/format";

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
    <div className="px-[var(--page-x)] lg:px-8">
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
      {/* The shared list header — this page used to stack its own title row on
          top of its own search row, with the title repeating what the shell bar
          already says. */}
      <ListShell
        titleSr="Usuarios"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar por email, nombre o RUT",
          ariaLabel: "Buscar usuarios",
        }}
        primaryAction={
          <Button
            variant="ink"
            size="icon"
            className={cn("rounded-full", CONTROL_SQUARE)}
            aria-label="Invitar usuario"
            title="Invitar usuario"
            onClick={() => setInviteOpen(true)}
          >
            <Plus className="size-4" strokeWidth={1.8} />
          </Button>
        }
      />

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
              {
                key: "rol",
                header: "Rol",
                cell: (u) => <Pill tone="neutral">{label("role", u.role)}</Pill>,
              },
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
            right: <Pill tone="neutral">{label("role", u.role)}</Pill>,
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
