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

/**
 * UF values already published for dates after today. The Banco Central fixes
 * the whole 10th -> 9th window in advance, so these are official figures, not
 * projections — a broker can quote a future closing with them.
 */
export function useUfForward() {
  return useQuery({
    queryKey: ["uf", "forward"],
    queryFn: () => ufApi.forward(),
    staleTime: 60 * 60_000,
    retry: false,
  });
}

/**
 * USD/CLP for the currency widget.
 *
 * Goes through our backend rather than calling mindicador.cl from the browser:
 * that direct call was the client's only third-party request, and it handed
 * every broker's IP to a service we don't control, with no cache, no fallback
 * and no protection from a CORS change upstream. The server caches it and
 * sanity-checks the value before we render it.
 */
export function useUsdToday() {
  return useQuery({
    queryKey: ["fx", "usd-clp", "today"],
    queryFn: () => ufApi.usdToday(),
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
        qc.invalidateQueries({ queryKey: ["uf"] });
      } catch {
        // Silent failure — UF widget falls back to last known value.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, qc]);
}
