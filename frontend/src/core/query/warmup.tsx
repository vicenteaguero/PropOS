import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";
import { useAuth } from "@shared/hooks/use-auth";
import { apiRequest } from "@shared/api/http";
import { contactsApi } from "@features/contacts/api/contacts-api";
import { contactsKeys } from "@features/contacts/hooks/use-contacts";
import { calendarApi } from "@features/calendar/api/calendar-api";

/**
 * Warms the queries the broker is about to need.
 *
 * Every page is lazily code-split, so on a cold navigation the data request
 * cannot even start until the chunk has downloaded and mounted: chunk → parse →
 * mount → useQuery → API. Prefetching from the shell moves the network round
 * trip off that critical path — by the time the chunk lands the rows are
 * usually already in cache.
 *
 * Keys must match the hooks exactly or this warms a cache nobody reads, hence
 * importing the same key factories and api clients the hooks use.
 */
export function QueryWarmup() {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const tenantId = user?.tenantId;

  useEffect(() => {
    if (!isAuthenticated || !tenantId) return;
    // requestIdleCallback so warming never competes with the first paint.
    const schedule =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 300);

    const handle = schedule(() => {
      const today = new Date();
      const from = startOfDay(today).toISOString();
      const to = endOfDay(today).toISOString();

      void queryClient.prefetchQuery({
        queryKey: contactsKeys.list({ limit: 50 }),
        queryFn: () => contactsApi.list({ limit: 50 }),
      });
      void queryClient.prefetchQuery({
        queryKey: ["calendar", "feed", from, to],
        queryFn: () => calendarApi.feed(from, to),
      });
      void queryClient.prefetchQuery({
        queryKey: ["analytics", "pending-count"],
        queryFn: () => apiRequest("/v1/analytics/pending-count"),
      });

      // Warm the route chunks too. Prefetched data is wasted if the user then
      // waits on a cold chunk download before anything can render it. These are
      // dynamic imports inside a callback, so they stay out of the entry bundle
      // and simply populate the module cache while the machine is idle.
      void import("@features/sections/pages/crm-section-page");
      void import("@features/sections/pages/agenda-section-page");
    });

    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof handle === "number") {
        window.cancelIdleCallback(handle);
      }
    };
    // tenantId in the deps: a workspace switch clears the cache, so the new
    // workspace has to be warmed again.
  }, [queryClient, isAuthenticated, tenantId]);

  return null;
}
