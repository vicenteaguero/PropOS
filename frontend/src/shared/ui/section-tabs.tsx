import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_ROW_COARSE } from "./touch-target";

export interface SectionTab {
  id: string;
  label: string;
  /** Admin scope required to see this tab; undefined means always visible. */
  scope?: string;
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
  const [params, setParams] = useSearchParams();
  const requested = params.get(param);
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];
  if (!active) return null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* Horizontal scroll instead of wrapping: a wrapped second row of tabs
          pushes the content down by a whole line on exactly the narrow screens
          that can least afford it. */}
      <div className="flex gap-4 overflow-x-auto border-b border-border px-[var(--page-x)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const isActive = t.id === active.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set(param, t.id);
                setParams(next, { replace: true });
              }}
              className={cn(
                "relative -mb-px shrink-0 border-b-2 pb-2.5 pt-2.5 text-[14px] transition-colors",
                TOUCH_TARGET_ROW_COARSE,
                isActive
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">{active.render()}</div>
    </div>
  );
}
