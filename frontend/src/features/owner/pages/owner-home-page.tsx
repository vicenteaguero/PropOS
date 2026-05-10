import { Link } from "react-router-dom";
import { Building2, ChevronRight } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { useMyGrants } from "@features/owner/hooks/use-my-grants";

export function OwnerHomePage() {
  const { data, isLoading, error, refetch } = useMyGrants();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="text-sm text-destructive">No pudimos cargar tus propiedades.</p>
        <button
          type="button"
          className="mt-3 text-sm text-primary underline"
          onClick={() => refetch()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const grants = data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Mis propiedades</h1>
        <p className="text-sm text-muted-foreground">
          Acá ves las propiedades a las que tu administrador te dio acceso.
        </p>
      </header>

      {grants.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no tenés propiedades asignadas</CardTitle>
            <CardDescription>
              Pedile a tu administrador que te otorgue acceso a una propiedad.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {grants.map((g) => (
            <Link
              key={g.id}
              to={`/owner/properties/${g.propertyId}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {g.propertyTitle ?? "(sin título)"}
                  </div>
                  {g.propertyAddress && (
                    <div className="truncate text-xs text-muted-foreground">
                      {g.propertyAddress}
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
