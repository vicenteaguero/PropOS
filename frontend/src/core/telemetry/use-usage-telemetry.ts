import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@shared/hooks/use-auth";
import { flush, startUsageTelemetry, trackPageView } from "@core/telemetry/usage";

/**
 * Binds usage telemetry to the router and the session.
 *
 * Mounted once, inside the router so it can see navigation and inside the auth
 * provider so it only records for a signed-in person. Nothing is recorded on the
 * login screen -- there is no tenant to attribute it to, and the ingest endpoint
 * would reject it anyway.
 */
export function useUsageTelemetry() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    return startUsageTelemetry();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // React re-runs this on any location change, including a query-param edit
    // from the tab strip. Those are the same screen, so guard on the pathname
    // rather than on the whole location -- otherwise switching tabs four times
    // reads as four page views.
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    trackPageView(location.pathname);
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    // Signing out drops the buffer's owner. Send what is already there while a
    // token still exists, rather than attributing it to whoever signs in next.
    if (isAuthenticated) return;
    void flush();
  }, [isAuthenticated]);
}
