import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Pill, Row } from "@shared/ui";
import { useAdminUsersList } from "@features/admin-users/hooks/use-admin-users";
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
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filters = useMemo(() => ({ search: search || undefined }), [search]);
  const { data, isLoading, error, refetch } = useAdminUsersList(filters);
  const users = data ?? [];

  return (
    <PageLayout width="md" noPadding className="pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Usuarios
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {data ? `${users.length} usuarios` : "Usuarios de la plataforma"}
          </p>
        </div>
        <Button
          variant="ink"
          size="icon-lg"
          className="rounded-full"
          aria-label="Invitar usuario"
          onClick={() => setInviteOpen(true)}
        >
          <Plus className="size-5" strokeWidth={1.8} />
        </Button>
      </div>

      {/* Search */}
      <div className="px-5 pb-4">
        <div className="relative">
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

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="mx-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No pudimos cargar los usuarios.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !error && users.length === 0 && (
        <div className="px-5">
          <EmptyState
            title="Sin usuarios"
            description="Invitá al primer usuario de la plataforma."
            actionLabel="Invitar usuario"
            onAction={() => setInviteOpen(true)}
          />
        </div>
      )}

      {!isLoading && !error && users.length > 0 && (
        <div>
          {users.map((u, i) => (
            <Row
              key={u.id}
              onClick={() => navigate(`/admin/users/${u.id}`)}
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
              right={
                <Pill tone="neutral">{u.role}</Pill>
              }
            />
          ))}
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
