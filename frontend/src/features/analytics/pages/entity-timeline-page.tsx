import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@features/documents/api/http";

interface TimelineEvent {
  event_at: string;
  event_type: "audit" | "interaction" | "note";
  event_subtype: string | null;
  source: string;
  actor: string | null;
  payload: Record<string, unknown>;
}

const TYPE_BADGE: Record<string, string> = {
  audit: "Audit",
  interaction: "Interacción",
  note: "Nota",
};

export function EntityTimelinePage() {
  const { table, id } = useParams<{ table: string; id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["timeline", table, id],
    queryFn: () =>
      apiRequest<TimelineEvent[]>(
        `/v1/analytics/entity-timeline?table_name=${table}&row_id=${id}`,
      ),
    enabled: !!table && !!id,
  });

  return (
    <div className="container max-w-3xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Cronología</h1>
        <p className="text-sm text-muted-foreground">
          {table} / <span className="font-mono">{id}</span>
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {isError && (
        <Card>
          <CardContent className="py-4 text-destructive text-sm">
            No pude cargar la cronología.
          </CardContent>
        </Card>
      )}
      {!isLoading && !isError && data?.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Sin eventos registrados todavía.
        </Card>
      )}

      <div className="space-y-2">
        {data?.map((e, i) => (
          <Card key={i}>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2 justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline">
                    {TYPE_BADGE[e.event_type] || e.event_type}
                  </Badge>
                  {e.event_subtype && (
                    <span className="text-muted-foreground text-xs">
                      {e.event_subtype}
                    </span>
                  )}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {e.event_at?.slice(0, 19).replace("T", " ")}
                </span>
              </div>
            </CardHeader>
            <CardContent className="py-2 text-xs">
              <p className="text-muted-foreground mb-1">
                source={e.source} {e.actor ? `· actor=${e.actor.slice(0, 8)}…` : ""}
              </p>
              <pre className="bg-muted p-2 rounded overflow-x-auto text-[10px]">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
