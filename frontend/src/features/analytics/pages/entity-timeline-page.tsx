import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@features/documents/api/http";
import { PageLayout } from "@shared/components/page-layout";
import { Pill, type PillTone } from "@shared/ui";

interface TimelineEvent {
  event_at: string;
  event_type: "audit" | "interaction" | "note";
  event_subtype: string | null;
  source: string;
  actor: string | null;
  payload: Record<string, unknown>;
}

const TYPE_LABEL: Record<string, string> = {
  audit: "Audit",
  interaction: "Interacción",
  note: "Nota",
};

const TYPE_TONE: Record<string, PillTone> = {
  audit: "neutral",
  interaction: "accent",
  note: "warning",
};

export function EntityTimelinePage() {
  const { table, id } = useParams<{ table: string; id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["timeline", table, id],
    queryFn: () =>
      apiRequest<TimelineEvent[]>(`/v1/analytics/entity-timeline?table_name=${table}&row_id=${id}`),
    enabled: !!table && !!id,
  });

  return (
    <PageLayout width="md" noPadding className="pb-10">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Cronología
        </h1>
        <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">
          {table} / {id}
        </p>
      </div>

      <div className="px-5">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            No pude cargar la cronología.
          </div>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Sin eventos registrados todavía.
          </div>
        )}

        <div className="space-y-2.5">
          {data?.map((e, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
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
                source={e.source} {e.actor ? `· actor=${e.actor.slice(0, 8)}…` : ""}
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-secondary p-3 text-xs text-foreground">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
