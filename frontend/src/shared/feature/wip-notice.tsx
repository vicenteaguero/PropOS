import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Hammer } from "lucide-react";
import { useFeature } from "@shared/feature/use-feature";
import { cn } from "@/lib/utils";

/**
 * How a `wip` feature says so.
 *
 * The state existed for months and drew nothing outside `FeatureGate`: a tenant
 * row said `finanzas = wip` and the broker saw an ordinary, finished-looking
 * section. "En desarrollo" as a bare label is barely better -- it tells someone
 * that something is unfinished without answering the only question they have,
 * which is whether they can use it today. So the banner is the sentence, and
 * the pill on the nav is only the pointer to it.
 */
export function FeatureWipBanner({ note, className }: { note: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-3",
        className,
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-warning/20">
        <Hammer className="size-[15px] text-warning" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-foreground">En desarrollo</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
          {note}
        </span>
      </span>
    </div>
  );
}

/**
 * Feature keys already announced further up the tree.
 *
 * `/admin/finanzas` gates the ROUTE on `finanzas` and its first tab on
 * `finanzas` too, so without this the same sentence would print twice, stacked.
 */
const AnnouncedContext = createContext<readonly string[]>([]);

/**
 * Renders `children`, preceded by the unfinished-feature banner when this
 * tenant has the key on `wip` and nobody has said so higher up.
 *
 * Deliberately does not gate anything: `wip` means usable. `locked` and
 * `hidden` are handled by `ProtectedRoute` / `SectionTabs`, which never reach
 * this component.
 */
export function FeatureWipFrame({
  feature,
  children,
  className,
}: {
  feature?: string;
  children: ReactNode;
  className?: string;
}) {
  const { showWip, note } = useFeature(feature);
  const announced = useContext(AnnouncedContext);
  const next = useMemo(() => (feature ? [...announced, feature] : announced), [announced, feature]);

  if (!feature || !showWip || !note || announced.includes(feature)) return <>{children}</>;

  return (
    <AnnouncedContext.Provider value={next}>
      <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <div className="shrink-0 px-[var(--page-x)] pt-3">
          <FeatureWipBanner note={note} />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </AnnouncedContext.Provider>
  );
}

/** The nav/tab marker. Points at the banner; it does not try to be it. */
export function WipDot({ className }: { className?: string }) {
  return (
    <span
      aria-label="En desarrollo"
      title="En desarrollo"
      className={cn("size-1.5 shrink-0 rounded-full bg-warning", className)}
    />
  );
}
