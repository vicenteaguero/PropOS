import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ufApi } from "../api/uf-api";
import { useAuth } from "@shared/hooks/use-auth";

const REFRESH_FLAG = "propos:uf-refresh-date";

export function useUfToday() {
  return useQuery({
    queryKey: ["uf", "today"],
    queryFn: () => ufApi.today(),
    staleTime: 60 * 60_000,
    retry: false,
  });
}

interface MindicadorSerie {
  serie: Array<{ fecha: string; valor: number }>;
}

export function useUsdToday() {
  return useQuery({
    queryKey: ["fx", "usd-clp", "today"],
    queryFn: async () => {
      const res = await fetch("https://mindicador.cl/api/dolar");
      if (!res.ok) throw new Error(`mindicador ${res.status}`);
      const json = (await res.json()) as MindicadorSerie;
      const point = json.serie?.[0];
      if (!point) throw new Error("no usd point");
      return { date: point.fecha.slice(0, 10), value_clp: point.valor };
    },
    staleTime: 60 * 60_000,
    retry: false,
  });
}

/**
 * Single-flight per browser per day. The first authenticated user on each
 * device hits POST /uf/refresh, which idempotently upserts today's value
 * + kicks off a backfill in the background. Concurrent calls are safe
 * (DB upsert), but this guard avoids unnecessary network hits.
 */
export function useUfDailyRefresh(): void {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = window.localStorage.getItem(REFRESH_FLAG);
    if (last === today) return;
    let cancelled = false;
    (async () => {
      try {
        await ufApi.refresh();
        if (cancelled) return;
        window.localStorage.setItem(REFRESH_FLAG, today);
        qc.invalidateQueries({ queryKey: ["uf", "today"] });
      } catch {
        // Silent failure — UF widget falls back to last known value.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, qc]);
}
