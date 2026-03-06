import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@shared/components/page-header/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { useUsers } from "@features/admin/hooks/use-users";
import type { UserRole } from "@features/admin/types";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  AGENT: "Agente",
  LANDOWNER: "Propietario",
  BUYER: "Comprador",
  CONTENT: "Contenido",
};

const ROLE_VARIANTS: Record<UserRole, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  AGENT: "secondary",
  LANDOWNER: "outline",
  BUYER: "outline",
  CONTENT: "secondary",
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function UsersListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UsersPage() {
  const { data: users, isLoading, isError, refetch } = useUsers();

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title="Equipo" description="Miembros del equipo y sus roles" />

      {isLoading && <UsersListSkeleton />}

      {isError && (
        <EmptyState
          title="Error al cargar"
          description="No se pudieron cargar los usuarios. Intentalo de nuevo."
          actionLabel="Reintentar"
          onAction={() => { refetch(); }}
        />
      )}

      {!isLoading && !isError && (!users || users.length === 0) && (
        <EmptyState
          title="Sin usuarios"
          description="Aun no hay usuarios registrados en el sistema."
        />
      )}

      {users && users.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Card key={user.id} className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar size="lg">
                  <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {user.full_name ?? "Sin nombre"}
                    </p>
                    <Badge variant={ROLE_VARIANTS[user.role]}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="size-3 shrink-0" />
                    {user.is_active ? "Activo" : "Inactivo"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
