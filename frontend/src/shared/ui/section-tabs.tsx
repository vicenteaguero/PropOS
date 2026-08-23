import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useTopbarSlot } from "@layouts/topbar-slot";
import { useIsImmersive } from "@layouts/immersive";
import { useAuth } from "@shared/hooks/use-auth";
import { entryFor, isVisible } from "@shared/feature/catalog";
import { FeatureLockedScreen } from "@shared/feature/feature-gate";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_ROW_COARSE } from "./touch-target";

export type TabBarVariant = "underline" | "pill" | "header";

export interface TabBarItem {
  id: string;
  label: string;
  /** Trailing count. Omit or pass 0 — an explicit zero badge is noise. */
  count?: number;
}

interface TabBarProps {
  items: TabBarItem[];
  value: string;
  onChange: (id: string) => void;
  /**
   * `underline` names a section (it is the page's identity, so it gets the
   * accent bar); `pill` switches a filter inside one; `header` is `underline`
   * shrunk to sit on the phone's top bar, without the rule beneath it.
   */
  variant?: TabBarVariant;
  /** Apply the page gutter. Off inside panes that already pad their content. */
  gutter?: boolean;
  className?: string;
}

/**
 * The app's one tab strip.
 *
 * There were two: `SectionTabs` (URL-driven, page gutter, 14px, gap-4) and
 * `Segmented` (controlled, hard-coded px-5, 15px, gap-5). Their metrics
 * disagreed on every axis, so a page that stacked them — the CRM did — showed
 * two underline bars whose labels did not line up and whose left edges sat 4px
 * apart. One component, two variants, one set of numbers.
 *
 * Both variants scroll horizontally rather than wrap: a wrapped second row of
 * tabs pushes content down by a whole line on exactly the narrow screens that
 * can least afford it.
 *
 * There is deliberately no edge fade. It was here, and it read as a rendering
 * fault — a blurred tab looks broken, not scrollable — while doing nothing for
 * the case that matters, which is a strip that overflows by 20px and so has no
 * room to show the fade anyway. The real fix for a strip that does not fit is
 * to make it fit.
 */
export function TabBar({
  items,
  value,
  onChange,
  variant = "underline",
  gutter = true,
  className,
}: TabBarProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const header = variant === "header";
  // `header` is `underline` with the chrome stripped: same accent bar, same
  // metrics rules, no page gutter and no rule beneath (the bar has its own).
  const underline = variant === "underline" || header;

  // Keep the active tab on screen. A deep link can select a tab that starts
  // scrolled out of view, which reads as "that tab is not there".
  //
  // Done by hand rather than with `scrollIntoView`, which scrolls EVERY
  // scrollable ancestor — the document included, even with `block: "nearest"`.
  // A `Segmented` sitting below the fold therefore yanked the whole page down
  // to itself on mount: Configuración opened ~1000px scrolled, past its first
  // three sections, because a dev-only switch at the bottom is a TabBar too.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector<HTMLElement>(`[data-tab-id="${value}"]`);
    if (!scroller || !el) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < scroller.scrollLeft) scroller.scrollLeft = left;
    else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = right - scroller.clientWidth;
    }
  }, [value]);

  return (
    <div
      className={cn(
        "relative",
        underline && !header && "border-b border-border",
        header && "min-w-0 flex-1",
        // The pill track is only as wide as its items, so the wrapper — which
        // anchors the fades — has to shrink with it or they float off the edge.
        !underline && "w-fit max-w-full",
        // Gutter on the wrapper, not on the scroller: `className` is merged
        // last, so a caller passing `px-0` (several do) still wins. On the
        // scroller it would be a different element and silently do nothing.
        gutter && (underline ? "px-[var(--page-x)]" : "mx-[var(--page-x)]"),
        className,
      )}
    >
      <div
        ref={scrollerRef}
        role="tablist"
        className={cn(
          "flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          underline ? "gap-1" : "gap-1 rounded-full bg-secondary p-1",
        )}
      >
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              data-tab-id={it.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(it.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 whitespace-nowrap transition-colors",
                TOUCH_TARGET_ROW_COARSE,
                header
                  ? "h-11 rounded-lg px-2.5 text-[15px] font-semibold"
                  : underline
                    ? "h-12 rounded-t-lg px-3 text-[15px] font-semibold"
                    : "h-10 rounded-full px-4 text-[14px] font-semibold",
                underline && !active && "text-muted-foreground hover:bg-secondary/60",
                underline && active && "text-foreground",
                !underline && !active && "text-muted-foreground hover:text-foreground",
                !underline && active && "bg-ink text-ink-foreground",
              )}
            >
              {it.label}
              {!!it.count && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums",
                    active
                      ? underline
                        ? "bg-primary/15 text-primary"
                        : "bg-background/20 text-background"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {it.count}
                </span>
              )}
              {/* Accent bar rather than a foreground one: the active section is
                  the page's identity, so it carries the tenant colour. Inset so
                  it tracks the label, not the hit target's padding. */}
              {underline && active && (
                <span
                  className={cn(
                    "absolute inset-x-2 h-[3px] rounded-full bg-primary",
                    header ? "bottom-1" : "-bottom-px",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}

export interface SectionTab extends TabBarItem {
  /** Admin scope required to see this tab; undefined means always visible. */
  scope?: string;
  /**
   * Feature key from `shared/feature/catalog`. `hidden` drops the tab, `locked`
   * keeps it and swaps the content for the locked screen, `wip` renders as
   * normal. Filtering here rather than in each section page means turning
   * Conversaciones off is a database row, not a deploy.
   */
  feature?: string;
  /**
   * Reachable, but not one of the section's headline views.
   *
   * Clientes has four entities and only two questions a broker opens the app
   * with — who is waiting on me, and what is in play. Personas and Propiedades
   * are catalogues you go to *from* those, so they keep their tab id (bookmarks,
   * push deep links and the "Propiedades" nav entry all point at one) but stay
   * out of a four-item strip that no longer fits a phone once it lives on the
   * header row. A secondary tab appears in the bar only while it is the open one.
   */
  secondary?: boolean;
  /**
   * Retired ids that should still land here. Tab ids leak into bookmarks, the
   * sidebar and the router's legacy redirects, so renaming one without an alias
   * silently dumps every old link on the section's first tab.
   */
  aliases?: string[];
  /** Rendered only while the tab is active — sub-pages stay lazily mounted. */
  render: () => ReactNode;
}

interface SectionTabsProps {
  tabs: SectionTab[];
  /** Query param carrying the active tab. Keeps deep links and Back working. */
  param?: string;
  className?: string;
}

/**
 * One page, several sub-views.
 *
 * The app had grown a route per noun — tareas, notas, calendario, personas,
 * interacciones, oportunidades — so finding anything meant knowing the whole
 * map by heart. Grouping them behind a tab bar keeps every destination one tap
 * from its siblings, and the tab lives in a query param so a link still points
 * at exactly what the sender was looking at.
 */
export function SectionTabs({ tabs: allTabs, param = "tab", className }: SectionTabsProps) {
  const { features } = useAuth();
  const tabs = allTabs.filter((t) => isVisible(features, t.feature));
  const barRef = useRef<HTMLDivElement>(null);
  const topbarHost = useTopbarSlot();
  // A surface inside a tab can take the whole screen (an open conversation).
  // The top bar unmounts, which releases the portal host — and without this the
  // strip would simply fall back to rendering in place, putting the section tabs
  // back on top of the very screen that asked for them to go.
  const immersive = useIsImmersive();
  usePublishTabsHeight(barRef, !topbarHost && !immersive);
  const [params, setParams] = useSearchParams();
  const requested = params.get(param);
  const active =
    tabs.find((t) => t.id === requested) ??
    tabs.find((t) => t.aliases?.includes(requested ?? "")) ??
    tabs.find((t) => !t.secondary) ??
    tabs[0];
  if (!active) return null;

  const gate = entryFor(features, active.feature);
  const renderActive = () =>
    gate.state === "locked" ? <FeatureLockedScreen note={gate.note} /> : active.render();

  // Secondary tabs are not in the strip unless one of them is what you are
  // looking at — otherwise leaving it would mean navigating to a tab that has
  // no button, and Back would be the only way out.
  const visible = tabs.filter((t) => !t.secondary || t.id === active.id);

  const bar = (
    <TabBar
      items={visible}
      value={active.id}
      // In the header the strip IS the bar, so it drops the page gutter (the
      // header row already has one) and the divider under it (the header has
      // its own edge). In place, it keeps both.
      variant={topbarHost ? "header" : "underline"}
      gutter={!topbarHost}
      onChange={(id) => {
        const next = new URLSearchParams(params);
        next.set(param, id);
        setParams(next, { replace: true });
      }}
    />
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {immersive ? null : topbarHost ? (
        createPortal(bar, topbarHost)
      ) : (
        <div ref={barRef} className="shrink-0">
          {bar}
        </div>
      )}
      <div className="min-h-0 flex-1">{renderActive()}</div>
    </div>
  );
}

/**
 * Publishes the bar's measured height to `--section-tabs-h` and clears it on
 * unmount. Measured rather than hardcoded because the bar's height follows the
 * font scale and the coarse-pointer touch padding.
 */
function usePublishTabsHeight(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = enabled ? ref.current : null;
    if (!el) {
      // Tabs living in the header occupy no strip of their own; leaving the last
      // measured value behind would make every viewport-pinned surface subtract
      // a bar that is not on screen.
      document.documentElement.style.setProperty("--section-tabs-h", "0px");
      return;
    }
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--section-tabs-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--section-tabs-h");
    };
  }, [ref, enabled]);
}
