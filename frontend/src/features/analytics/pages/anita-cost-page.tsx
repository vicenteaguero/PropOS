import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@features/documents/api/http";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AnitaCost {
  totals: {
    tokens_in: number;
    tokens_out: number;
    cost_cents: number;
    message_count: number;
  };
  by_session: {
    session_id: string;
    tokens_in: number;
    tokens_out: number;
    cost_cents: number;
    messages: number;
    provider: string | null;
    model: string | null;
    last_at: string | null;
  }[];
  by_day: { day: string; cost_cents: number }[];
}

const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(4)}`;

export function AnitaCostPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "anita-cost"],
    queryFn: () => apiRequest<AnitaCost>("/v1/analytics/anita-cost"),
  });

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-8 flex justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="container max-w-5xl py-6">
        <p className="text-destructive">No pude cargar costos.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Costo Anita (últimos 30 días)</h1>
        <p className="text-sm text-muted-foreground">
          Tokens consumidos + USD acumulados (estimado en cents).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Mensajes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.totals.message_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Tokens entrada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {data.totals.tokens_in.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Tokens salida</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {data.totals.tokens_out.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Costo total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {fmtUSD(data.totals.cost_cents)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Costo por día</CardTitle>
        </CardHeader>
        <CardContent>
          {data.by_day.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sin actividad aún.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.by_day}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtUSD(v)} />
                <Tooltip
                  formatter={(v) => fmtUSD(Number(v))}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="cost_cents" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sesiones (top 50 recientes)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Sesión</th>
                <th className="py-2 pr-4">Última msg</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Mensajes</th>
                <th className="py-2 pr-4">Tokens in</th>
                <th className="py-2 pr-4">Tokens out</th>
                <th className="py-2 pr-4">Costo</th>
              </tr>
            </thead>
            <tbody>
              {data.by_session.map((s) => (
                <tr key={s.session_id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">
                    {s.session_id.slice(0, 8)}…
                  </td>
                  <td className="py-2 pr-4">
                    {s.last_at ? s.last_at.slice(0, 16).replace("T", " ") : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {s.provider} {s.model ? `(${s.model})` : ""}
                  </td>
                  <td className="py-2 pr-4">{s.messages}</td>
                  <td className="py-2 pr-4">{s.tokens_in.toLocaleString()}</td>
                  <td className="py-2 pr-4">{s.tokens_out.toLocaleString()}</td>
                  <td className="py-2 pr-4">{fmtUSD(s.cost_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
