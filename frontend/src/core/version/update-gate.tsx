import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  applyUpdate,
  canAttempt,
  clearAttempts,
  fetchDeployedVersion,
  isStale,
  onUpdateRequested,
  recordAttempt,
} from "@core/version/version";

/** Matches the service-worker update cadence; the manifest is a few hundred bytes. */
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Let the overlay paint before the reload blanks the page. Without this the user
 * sees a white flash and no explanation for why the app restarted.
 */
const OVERLAY_PAINT_MS = 400;

function UpdateOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-4 bg-background px-8 text-center"
    >
      <Loader2 className="size-8 animate-spin text-primary" strokeWidth={1.8} />
      <div className="space-y-1.5">
        <p className="text-base font-medium text-foreground">Actualizando aplicación</p>
        <p className="text-sm text-muted-foreground">
          Estamos cargando la última versión. Toma unos segundos.
        </p>
      </div>
    </div>
  );
}

/**
 * Holds the app on a loader whenever the server is serving a newer build than
 * this tab is running, and reloads onto it. See `version.ts` for why the service
 * worker alone does not cover this.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Dev has no service worker and no emitted manifest, so every probe would
    // 404 and resolve to `null` — harmless, but pointless traffic on every HMR.
    if (!import.meta.env.PROD) return;

    let cancelled = false;
    const controller = new AbortController();

    const check = async () => {
      // A hidden tab cannot show the overlay, and reloading one the user is not
      // looking at throws away whatever they had on screen.
      if (cancelled || document.visibilityState !== "visible") return;

      const deployed = await fetchDeployedVersion(controller.signal);
      if (cancelled) return;

      if (!isStale(deployed)) {
        if (deployed !== null) clearAttempts();
        return;
      }

      const target = deployed as string;
      if (!canAttempt(target)) return;
      recordAttempt(target);
      setUpdating(true);
    };

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);

    // Resuming an installed PWA fires these but not a navigation, which is
    // exactly the case where the running bundle is oldest.
    const onWake = () => void check();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    // The service worker sometimes notices a new build before the poll does.
    onUpdateRequested(() => setUpdating(true));

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      onUpdateRequested(null);
    };
  }, []);

  useEffect(() => {
    if (!updating) return;
    const timer = window.setTimeout(() => void applyUpdate(), OVERLAY_PAINT_MS);
    return () => window.clearTimeout(timer);
  }, [updating]);

  return (
    <>
      {children}
      {updating && <UpdateOverlay />}
    </>
  );
}
