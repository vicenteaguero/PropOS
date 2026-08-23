import { PageLayout } from "@shared/components/page-layout/page-layout";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "@shared/api/http";
import { useAuth } from "@shared/hooks/use-auth";
import { usePageTitle } from "@app/page-meta";
import { PageHeader } from "@shared/components/page-header/page-header";
import { PageSkeleton, Segmented, SectionLabel } from "@shared/ui";
import { ErrorState } from "@shared/ui";
import { Input } from "@/components/ui/input";
import type { FeatureEntry, FeatureMap, FeatureState } from "@shared/feature/catalog";

interface CatalogItem {
  key: string;
  label_es: string;
  scope: string | null;
}

const STATES: { id: FeatureState; label: string }[] = [
  { id: "on", label: "Activa" },
  { id: "wip", label: "En desarrollo" },
  { id: "locked", label: "Bloqueada" },
  { id: "hidden", label: "Oculta" },
];

const SCOPE_LABEL = {
  tenant: "Este workspace",
  global: "Todos los workspaces",
} as const;

/**
 * The dev-admin switchboard.
 *
 * Built to be used from a phone, standing next to whoever just hit the broken
 * thing: four states in one strip, a note that becomes the sentence the user
 * reads, and no save button -- picking a state IS the write. The alternative,
 * editing every user's `admin_scope` one at a time, is what this replaces.
 */
export function FeaturesPage() {
  usePageTitle("Funcionalidades");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [target, setTarget] = useState<"tenant" | "global">("tenant");

  const catalog = useQuery<CatalogItem[]>({
    queryKey: ["features", "catalog"],
    queryFn: () => apiRequest("/v1/admin/features/catalog"),
    staleTime: 5 * 60_000,
  });

  const states = useQuery<FeatureMap>({
    queryKey: ["features", "states", user?.tenantId],
    queryFn: () => apiRequest("/v1/features"),
  });

  const save = useMutation({
    mutationFn: (vars: { key: string; state: FeatureState; note: string | null }) =>
      apiRequest(`/v1/admin/features/${vars.key}`, {
        method: "PUT",
        body: {
          state: vars.state,
          note: vars.note,
          // A global write is the absence of a tenant, not a special flag.
          tenant_id: target === "tenant" ? user?.tenantId : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["features"] });
      toast.success("Guardado");
    },
    onError: (err: unknown) => toast.error(String(err)),
  });

  if (catalog.isLoading || states.isLoading) return <PageSkeleton variant="list" />;
  if (catalog.error || states.error) {
    return (
      <ErrorState
        message="No pudimos cargar las funcionalidades."
        onRetry={() => {
          void catalog.refetch();
          void states.refetch();
        }}
      />
    );
  }

  const map = states.data ?? {};

  return (
    // A bare route with no gutter and no clearance: the switchboard ran edge to
    // edge on a phone and its last row sat under the floating nav.
    <PageLayout width="md" noPadding className="flex flex-col gap-4 px-[var(--page-x)] pt-4">
      <PageHeader title="Funcionalidades" backTo="/admin/settings" />

      <Segmented
        items={[
          { id: "tenant", label: SCOPE_LABEL.tenant },
          { id: "global", label: SCOPE_LABEL.global },
        ]}
        value={target}
        onChange={(id) => setTarget(id as "tenant" | "global")}
      />

      {/* The distinction matters and is easy to miss on a phone: a global row is
          the default every workspace inherits, and a workspace row overrides it.
          Reading the list always shows the EFFECTIVE state for this workspace,
          whichever target is selected for writing. */}
      <SectionLabel>
        {target === "tenant"
          ? "Los cambios afectan solo a este workspace."
          : "Los cambios son el valor por defecto de todos los workspaces."}
      </SectionLabel>

      <div className="flex flex-col gap-5">
        {(catalog.data ?? []).map((item) => (
          <FeatureRow
            key={item.key}
            item={item}
            entry={map[item.key] ?? { state: "on", note: null }}
            saving={save.isPending && save.variables?.key === item.key}
            onChange={(state, note) => save.mutate({ key: item.key, state, note })}
          />
        ))}
      </div>
    </PageLayout>
  );
}

function FeatureRow({
  item,
  entry,
  saving,
  onChange,
}: {
  item: CatalogItem;
  entry: FeatureEntry;
  saving: boolean;
  onChange: (state: FeatureState, note: string | null) => void;
}) {
  const [note, setNote] = useState(entry.note ?? "");
  // The note is only ever shown to a user in these two states, so asking for it
  // the rest of the time is asking for text nobody will read.
  const showNote = entry.state === "locked" || entry.state === "wip";
  // A `wip` feature with no note is not silent -- `WIP_NOTES` carries a default
  // sentence per key, so this field overrides rather than fills a void.
  const placeholder =
    entry.state === "wip"
      ? "Qué le decimos al usuario (vacío = texto por defecto)"
      : "Qué le decimos al usuario";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{item.label_es}</span>
        <span className="font-mono text-xs text-muted-foreground">{item.key}</span>
      </div>
      <Segmented
        items={STATES}
        value={entry.state}
        gutter={false}
        variant="pill"
        onChange={(id) => onChange(id as FeatureState, note.trim() || null)}
      />
      {showNote && (
        <Input
          value={note}
          disabled={saving}
          placeholder={placeholder}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if ((entry.note ?? "") !== note.trim()) onChange(entry.state, note.trim() || null);
          }}
          className="h-10 rounded-xl text-sm"
        />
      )}
    </div>
  );
}
