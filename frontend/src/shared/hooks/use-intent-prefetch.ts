import { useCallback, useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Start fetching what the user is about to open, while they are still deciding.
 *
 * Between the cursor landing on a row and the click there is a real gap —
 * roughly 200–300 ms on a desktop, 80–100 ms between touch and lift on a phone.
 * That is most of a request. Spending it means the detail is already in cache
 * by the time the route mounts, and the page opens without a skeleton.
 *
 * Nothing in the app did this: `QueryWarmup` prefetches a handful of screens at
 * login and that is the whole of it.
 */

/** Long enough that sweeping the cursor down a list does not fetch every row. */
const INTENT_DELAY_MS = 80;

export interface IntentPrefetch {
  /** Same shape `useQuery` would use, or the prefetch warms a cache nobody reads. */
  queryKey: QueryKey;
  queryFn: () => Promise<unknown>;
  staleTime?: number;
}

export function useIntentPrefetch() {
  const qc = useQueryClient();
  const timer = useRef<number | undefined>(undefined);
  // Keyed by serialised query key: a row the cursor crosses twice must not
  // queue a second request.
  const requested = useRef(new Set<string>());

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return useCallback(
    (...queries: IntentPrefetch[]) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        for (const query of queries) {
          const id = JSON.stringify(query.queryKey);
          if (requested.current.has(id)) continue;
          requested.current.add(id);
          void qc.prefetchQuery({
            queryKey: query.queryKey,
            queryFn: query.queryFn,
            // A prefetch is a guess. Honouring staleTime means an already-fresh
            // entry costs nothing, which is what makes it safe to fire on hover.
            staleTime: query.staleTime ?? 30_000,
          });
        }
      }, INTENT_DELAY_MS);
    },
    [qc],
  );
}
