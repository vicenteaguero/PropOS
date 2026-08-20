import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_ROW_COARSE } from "./touch-target";

export type TabBarVariant = "underline" | "pill";

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
   * accent bar); `pill` switches a filter inside one.
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
 * can least afford it. Because that scroll is otherwise invisible, the strip
 * paints a fade over whichever edge still has content behind it.
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
  const { atStart, atEnd, sync } = useOverflowEdges(scrollerRef, items.length);
  const underline = variant === "underline";

  // Keep the active tab on screen. A deep link can select a tab that starts
  // scrolled out of view, which reads as "that tab is not there".
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-tab-id="${value}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div
      className={cn(
        "relative",
        underline && "border-b border-border",
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
        onScroll={sync}
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
                underline
                  ? "h-12 rounded-t-lg px-3 text-[15px] font-semibold"
                  : "h-10 rounded-full px-4 text-[14px] font-semibold",
                underline && !active && "text-muted-foreground hover:bg-secondary/60",
                underline && active && "text-foreground",
                !underline && !active && "text-muted-foreground hover:text-foreground",
                !underline && active && "bg-foreground text-background",
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
                <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Scroll affordance: the fade has to start from whatever sits behind the
          strip, which is the page for `underline` and the track for `pill`. */}
      <ScrollFade side="left" hidden={atStart} underline={underline} />
      <ScrollFade side="right" hidden={atEnd} underline={underline} />
    </div>
  );
}

function ScrollFade({
  side,
  hidden,
  underline,
}: {
  side: "left" | "right";
  hidden: boolean;
  underline: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 w-10 transition-opacity",
        underline ? "" : "rounded-full",
        side === "left" ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l",
        underline ? "from-background to-transparent" : "from-secondary to-transparent",
        hidden && "opacity-0",
      )}
    />
  );
}

/**
 * Tracks whether a horizontal scroller is pinned to either end, so the caller
 * can hide the fade on the edge that has nothing behind it. Re-measures on
 * resize and whenever the item count changes.
 */
function useOverflowEdges(ref: React.RefObject<HTMLElement | null>, itemCount: number) {
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({
      atStart: el.scrollLeft <= 1,
      // `max <= 1` covers "fits entirely", which must hide BOTH fades.
      atEnd: max <= 1 || el.scrollLeft >= max - 1,
    });
  }, [ref]);

  useLayoutEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, sync, itemCount]);

  return { ...edges, sync };
}

export interface SectionTab extends TabBarItem {
  /** Admin scope required to see this tab; undefined means always visible. */
  scope?: string;
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
export function SectionTabs({ tabs, param = "tab", className }: SectionTabsProps) {
  const barRef = useRef<HTMLDivElement>(null);
  usePublishTabsHeight(barRef);
  const [params, setParams] = useSearchParams();
  const requested = params.get(param);
  const active =
    tabs.find((t) => t.id === requested) ??
    tabs.find((t) => t.aliases?.includes(requested ?? "")) ??
    tabs[0];
  if (!active) return null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div ref={barRef} className="shrink-0">
        <TabBar
          items={tabs}
          value={active.id}
          onChange={(id) => {
            const next = new URLSearchParams(params);
            next.set(param, id);
            setParams(next, { replace: true });
          }}
        />
      </div>
      <div className="min-h-0 flex-1">{active.render()}</div>
    </div>
  );
}

/**
 * Publishes the bar's measured height to `--section-tabs-h` and clears it on
 * unmount. Measured rather than hardcoded because the bar's height follows the
 * font scale and the coarse-pointer touch padding.
 */
function usePublishTabsHeight(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--section-tabs-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--section-tabs-h");
    };
  }, [ref]);
}
