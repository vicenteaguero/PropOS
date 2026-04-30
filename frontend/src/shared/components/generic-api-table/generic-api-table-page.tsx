import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@features/documents/api/http";

export interface ColumnDef {
  key: string;
  label: string;
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

interface Props {
  title: string;
  description?: string;
  endpoint: string; // e.g. "/v1/transactions"
  columns: ColumnDef[];
}

/**
 * Throwaway list view used while per-entity pages are unbuilt.
 * Useful so the router has something to render per nav item.
 */
export function GenericApiTablePage({
  title,
  description,
  endpoint,
  columns,
}: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["generic-list", endpoint],
    queryFn: () => apiRequest<Record<string, unknown>[]>(endpoint),
  });

  return (
    <div className="container max-w-6xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {isError && (
        <Card>
          <CardContent className="py-4 text-destructive text-sm">
            {error instanceof Error ? error.message : "Error cargando datos"}
          </CardContent>
        </Card>
      )}
      {!isLoading && !isError && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{data?.length ?? 0} registros</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {columns.map((c) => (
                    <th key={c.key} className="py-2 pr-4 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.map((row, i) => (
                  <tr key={(row.id as string) ?? i} className="border-b last:border-0">
                    {columns.map((c) => {
                      const raw = row[c.key];
                      const text = c.format
                        ? c.format(raw, row)
                        : raw == null
                        ? "—"
                        : typeof raw === "object"
                        ? JSON.stringify(raw)
                        : String(raw);
                      return (
                        <td key={c.key} className="py-2 pr-4 text-xs">
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
