import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@shared/api/http";
import { PageLayout } from "@shared/components/page-layout";
import { ErrorState, PageSkeleton, Pill, type PillTone } from "@shared/ui";
import { usePageTitle } from "@app/page-meta";

interface TimelineEvent {
  event_at: string;
  event_type: "audit" | "interaction" | "note";
  event_subtype: string | null;
  source: string;
  actor: string | null;
  payload: Record<string, unknown>;
}

const TYPE_LABEL: Record<string, string> = {
  audit: "Auditoría",
  interaction: "Interacción",
  note: "Nota",
};

/** Column name → readable field name. Payload keys are an open vocabulary, so
 *  unknown ones just lose their underscores instead of being dropped. */
function fieldName(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Renders one payload value as text — never as a JSON blob. */
function fieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return value.toLocaleString("es-CL");
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map((v) => fieldValue(v)).join(", ");
  }
  return JSON.stringify(value);
}

const TYPE_TONE: Record<string, PillTone> = {
  audit: "neutral",
  interaction: "accent",
  note: "warning",
};

export function EntityTimelinePage() {
  usePageTitle("Historial");
  const { table, id } = useParams<{ table: string; id: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["timeline", table, id],
    queryFn: () =>
      apiRequest<TimelineEvent[]>(`/v1/analytics/entity-timeline?table_name=${table}&row_id=${id}`),
    enabled: !!table && !!id,
  });

  return (
    <PageLayout width="md" noPadding className="pb-10 lg:max-w-5xl lg:px-8 lg:pt-4">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-foreground">
          Cronología
        </h1>
      </div>

      <div className="px-5">
        {isLoading && <PageSkeleton variant="list" count={4} />}

        {isError && (
          <ErrorState
            message="No se pudo cargar la cronología."
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Sin eventos registrados todavía.
          </div>
        )}

        <div className="space-y-2.5">
          {data?.map((e, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill tone={TYPE_TONE[e.event_type] ?? "neutral"}>
                    {TYPE_LABEL[e.event_type] ?? e.event_type}
                  </Pill>
                  {e.event_subtype && (
                    <span className="text-xs text-muted-foreground">{e.event_subtype}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {e.event_at?.slice(0, 19).replace("T", " ")}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Origen: {e.source}
                {e.actor ? ` · Autor: ${e.actor.slice(0, 8)}…` : ""}
              </p>
              {Object.keys(e.payload).length > 0 && (
                <>
                  <dl className="mt-2 rounded-xl bg-secondary p-3 text-xs">
                    {Object.entries(e.payload).map(([k, v]) => (
                      <div key={k} className="flex gap-3 py-0.5">
                        <dt className="w-40 shrink-0 text-muted-foreground">{fieldName(k)}</dt>
                        <dd className="min-w-0 flex-1 break-words text-foreground">
                          {fieldValue(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Ver detalle técnico
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-xl bg-secondary p-3 text-xs text-foreground">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </details>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default EntityTimelinePage;
