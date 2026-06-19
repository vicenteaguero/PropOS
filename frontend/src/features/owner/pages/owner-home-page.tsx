import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight } from "lucide-react";
import { PageLayout } from "@shared/components/page-layout";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { Pill } from "@shared/ui";
import { useMyGrants } from "@features/owner/hooks/use-my-grants";
import type { PropertyGrant } from "@shared/types/auth";

function PropertyCard({ grant, onClick }: { grant: PropertyGrant; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full overflow-hidden rounded-2xl bg-card text-left transition active:scale-[0.99]"
    >
      {/* Photo placeholder */}
      <div className="relative h-40 w-full bg-gradient-to-br from-secondary to-muted text-foreground">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, currentColor 0 12px, transparent 12px 24px)",
          }}
        />
        <span className="absolute left-3 top-3 grid size-10 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur">
          <Building2 className="size-5" strokeWidth={1.8} />
        </span>
        {grant.capabilities.length > 0 && (
          <span className="absolute right-3 top-3">
            <Pill tone="neutral">
              {grant.capabilities.length} {grant.capabilities.length === 1 ? "permiso" : "permisos"}
            </Pill>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold leading-tight text-foreground">
            {grant.propertyTitle ?? "(sin título)"}
          </div>
          {grant.propertyAddress && (
            <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {grant.propertyAddress}
            </div>
          )}
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      </div>
    </button>
  );
}

export function OwnerHomePage() {
  const navigate = useNavigate();
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
      <PageLayout width="sm" centered>
        <div className="text-center">
          <p className="text-sm text-destructive">No pudimos cargar tus propiedades.</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-primary hover:underline"
            onClick={() => refetch()}
          >
            Reintentar
          </button>
        </div>
      </PageLayout>
    );
  }

  const grants = data ?? [];

  return (
    <PageLayout width="sm" noPadding className="pb-6">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Mis propiedades
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {grants.length > 0
            ? "Las propiedades a las que tu administrador te dio acceso."
            : "Acá verás las propiedades que tu administrador comparta contigo."}
        </p>
      </div>

      {grants.length === 0 ? (
        <div className="px-5 pt-6">
          <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
            <span className="mb-4 grid size-14 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Building2 className="size-7" strokeWidth={1.6} />
            </span>
            <h3 className="text-lg font-semibold text-foreground">Aún no tienes propiedades</h3>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Pídele a tu administrador que te otorgue acceso a una propiedad.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 px-5">
          {grants.map((g) => (
            <PropertyCard
              key={g.id}
              grant={g}
              onClick={() => navigate(`/owner/properties/${g.propertyId}`)}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
