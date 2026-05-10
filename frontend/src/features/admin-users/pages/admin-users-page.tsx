import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { useAdminUsersList } from "@features/admin-users/hooks/use-admin-users";
import { useAuth } from "@shared/hooks/use-auth";
import { InviteUserDrawer } from "@features/admin-users/components/invite-user-drawer";

export function AdminUsersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filters = useMemo(() => ({ search: search || undefined }), [search]);
  const { data, isLoading, error, refetch } = useAdminUsersList(filters);

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button onClick={() => setInviteOpen(true)} size="sm">
          <UserPlus className="mr-1.5 size-4" /> Invitar usuario
        </Button>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, nombre o RUT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-destructive">
            No pudimos cargar los usuarios.
            <Button variant="link" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (data ?? []).length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay usuarios. Invitá al primero.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(data ?? []).map((u) => (
          <Link
            key={u.id}
            to={`/admin/users/${u.id}`}
            className="block rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {u.full_name || "(sin nombre)"}
                  </span>
                  {u.is_dev_admin && (
                    <Badge className="bg-amber-500/20 text-[10px] text-amber-400 hover:bg-amber-500/20">
                      DEV
                    </Badge>
                  )}
                  {!u.is_active && (
                    <Badge variant="destructive" className="text-[10px]">
                      Deshabilitado
                    </Badge>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                <span>{u.role}</span>
                <span>·</span>
                <span>{u.view}</span>
                {u.rut && (
                  <>
                    <span>·</span>
                    <span>{u.rut}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <InviteUserDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentTenantId={user?.tenantId}
      />
    </div>
  );
}
