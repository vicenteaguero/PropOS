import { useLayoutEffect, useRef } from "react";

/** 11rem / 15rem, the bounds the expanded rail is clamped between. */
const MIN_PX = 176;
const MAX_PX = 240;

/**
 * Everything on a nav row that is not the label: the group's horizontal padding
 * (8+8), the button's (8+8), the 18px icon, the 8px gap between icon and label,
 * and 12px of trailing slack so a badge or the truncation ellipsis never sits
 * flush against the edge.
 */
const CHROME_PX = 16 + 16 + 18 + 8 + 12;

interface Props {
  labels: string[];
  onMeasure: (px: number) => void;
}

/**
 * Measures the widest nav label so the expanded sidebar can be sized by its
 * content instead of by a constant.
 *
 * The rail was a fixed 16rem chosen independently of what it holds; with
 * "Documentos" as the longest label, roughly half of it was empty. CSS alone
 * cannot express this: `max-content` is not a `<length>`, so it may not appear
 * inside `clamp()`, and the collapse animation needs `--sidebar-width` to stay
 * an interpolatable length (see SIDEBAR_TRANSITION in components/ui/sidebar).
 * So the intrinsic width is measured here and clamped in JS, and the variable
 * it feeds stays exactly what the animation already expects.
 *
 * The probe is rendered, not hidden with `display: none` — a display:none
 * subtree has no layout and therefore no measurable width.
 */
export function SidebarWidthProbe({ labels, onMeasure }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const key = labels.join(" ");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      onMeasure(Math.min(MAX_PX, Math.max(MIN_PX, Math.ceil(el.offsetWidth) + CHROME_PX)));
    measure();
    // Fonts land after first paint; a web font swap changes the intrinsic width.
    if (document.fonts?.ready) void document.fonts.ready.then(measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      ref={ref}
      aria-hidden
      // Same type scale as ITEM_CLASS in app-sidebar.tsx. `w-max` makes the box
      // the widest child's max-content width, which is the number we want.
      className="pointer-events-none fixed left-0 top-0 -z-50 w-max text-[13px] font-medium opacity-0"
    >
      {labels.map((l) => (
        <div key={l} className="whitespace-nowrap">
          {l}
        </div>
      ))}
    </div>
  );
}
