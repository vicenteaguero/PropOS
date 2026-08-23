import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { BottomSheet, Pill } from "@shared/ui";
import { useFeature } from "@shared/feature/use-feature";
import { cn } from "@/lib/utils";

const LOCKED_FALLBACK = "Todavía no está disponible. Lo estamos preparando.";

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  /** Rendered instead of the children when the feature is hidden. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * Wraps a block whose availability is decided per tenant.
 *
 * The three states it draws are deliberately different experiences:
 *
 * - `hidden` renders the fallback (nothing, by default). No trace.
 * - `locked` renders the block dimmed and inert, with a "Próximamente" pill.
 *   Tapping it opens a sheet with the reason. Showing the shape of a feature
 *   and saying why it is closed reads as a product with a roadmap; removing it
 *   silently reads as a product that lost something.
 * - `wip` renders the block untouched apart from an "En desarrollo" pill, so
 *   the person using it knows to expect rough edges instead of reporting them.
 *
 * `pointer-events-none` on the content is the whole interaction block, so the
 * overlay button has to sit OUTSIDE it -- otherwise the explanation is as
 * unclickable as the thing it explains.
 */
export function FeatureGate({ feature, children, fallback = null, className }: FeatureGateProps) {
  const { state, note, showWip } = useFeature(feature);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (state === "hidden") return <>{fallback}</>;

  if (state === "locked") {
    return (
      <>
        <div className={cn("relative", className)}>
          <div aria-hidden className="pointer-events-none select-none opacity-40 grayscale">
            {children}
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="absolute inset-0 flex items-start justify-end p-2"
            aria-label={`${feature}: próximamente`}
          >
            <Pill tone="neutral">
              <Lock className="size-3" strokeWidth={2} />
              Próximamente
            </Pill>
          </button>
        </div>
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Próximamente">
          <p className="px-1 pb-6 text-sm text-muted-foreground">{note || LOCKED_FALLBACK}</p>
        </BottomSheet>
      </>
    );
  }

  // `showWip` and not `state === "wip"`: the dev admin who set the state does
  // not need a badge on every block they flipped.
  if (showWip) {
    return (
      <>
        <div className={cn("relative", className)}>
          <div className="absolute right-2 top-2 z-10">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={`${feature}: en desarrollo`}
            >
              <Pill tone="warning">En desarrollo</Pill>
            </button>
          </div>
          {children}
        </div>
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="En desarrollo">
          <p className="px-1 pb-6 text-sm text-muted-foreground">{note}</p>
        </BottomSheet>
      </>
    );
  }

  return <>{children}</>;
}

/**
 * Full-page version, for a route whose feature is locked.
 *
 * Separate from `FeatureGate` because there is no content to dim: the route
 * never rendered. `ProtectedRoute` returns this.
 */
export function FeatureLockedScreen({ note }: { note?: string | null }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-secondary">
        <Lock className="size-6 text-muted-foreground" strokeWidth={1.8} />
      </span>
      <p className="text-base font-semibold">Próximamente</p>
      <p className="max-w-sm text-sm text-muted-foreground">{note || LOCKED_FALLBACK}</p>
    </div>
  );
}
