import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
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

  // Wake the backend the moment there is a session, ahead of everything else.
  //
  // Cloud Run runs this service at `--min-instances=0` (a deliberate cost
  // choice, see config/docker/cloudbuild.yaml), so the first request after a
  // few idle minutes pays a container start — measured at 1.43 s against 0.21 s
  // warm. Spending it on `/health`, while the broker is still reading Inicio,
  // means the first request they actually wait on arrives warm. Not on the idle
  // callback: the whole point is to be first.
  useEffect(() => {
    if (!isAuthenticated) return;
    void fetch("/health").catch(() => {
      // A cold instance can refuse the very first connection. The next real
      // request will start it; there is nothing to report here.
    });
  }, [isAuthenticated]);

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
      // The calendar does not open on "today" — desktop opens on the week and
      // the phone on the month grid, each asking for its own range. Warming
      // only today therefore warmed a key nobody reads, and the agenda still
      // fetched from cold on arrival: the several-second wait on the surface a
      // broker opens first every morning.
      //
      // The ranges below mirror calendar-page's own arithmetic EXACTLY,
      // `addDays(end, 1)` included — a key that differs by one day is a cache
      // miss, and the prefetch silently does nothing.
      const warmRange = (start: Date, end: Date) => {
        const from = start.toISOString();
        const to = addDays(end, 1).toISOString();
        void queryClient.prefetchQuery({
          queryKey: ["calendar", "feed", from, to],
          queryFn: () => calendarApi.feed(from, to),
        });
      };
      warmRange(startOfWeek(today, { weekStartsOn: 1 }), endOfWeek(today, { weekStartsOn: 1 }));
      warmRange(
        startOfWeek(startOfMonth(today), { weekStartsOn: 1 }),
        endOfWeek(endOfMonth(today), { weekStartsOn: 1 }),
      );
      void queryClient.prefetchQuery({
        queryKey: ["analytics", "pending-count"],
        queryFn: () => apiRequest("/v1/analytics/pending-count"),
      });

      // Warm the route chunks too. Prefetched data is wasted if the user then
      // waits on a cold chunk download before anything can render it. These are
      // dynamic imports inside a callback, so they stay out of the entry bundle
      // and simply populate the module cache while the machine is idle.
      void import("@features/sections/pages/clients-section-page");
      void import("@features/sections/pages/agenda-section-page");
      void import("@features/settings/pages/settings-page");

      // Configuración's own two requests. It is reached from the "Más" sheet in
      // two taps and used to open with a full-page skeleton behind a cold
      // chunk AND two serial round trips.
      void queryClient.prefetchQuery({
        queryKey: ["tenant", "me"],
        queryFn: () => apiRequest("/v1/tenants/me"),
        staleTime: 5 * 60_000,
      });
      void queryClient.prefetchQuery({
        queryKey: ["settings", "me"],
        queryFn: () => apiRequest("/v1/users/me"),
      });
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
