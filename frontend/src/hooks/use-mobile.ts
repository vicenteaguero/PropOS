import * as React from "react";

/**
 * ONE breakpoint ladder for the whole app.
 *
 * Previously two hooks owned two thresholds that nobody reconciled: the shell
 * switched at 768 and the page layouts switched at 1024, so 768–1023px got
 * desktop chrome wrapped around mobile content. iPad portrait is exactly
 * 768×1024 and landed squarely in that hole.
 *
 * The fix is structural, not numeric: `useIsMobile` and `useIsDesktop` are now
 * exact complements of a single threshold, so a dead band cannot reappear.
 * Tablets are treated as small workstations — sidebar shell, master-detail
 * layouts — because they have the width for it and their users sit down to
 * work. `WIDE_BREAKPOINT` stays available for the extras a tablet can't afford
 * (third pane, wide gutters).
 *
 * Keep these in step with Tailwind's `md` / `lg`, which the same layouts use
 * for their CSS half of the switch.
 */

/** Phone ↔ workstation. Tailwind `md`. */
export const SHELL_BREAKPOINT = 768;
/** Where a third pane and wider gutters become affordable. Tailwind `lg`. */
export const WIDE_BREAKPOINT = 1024;

export type Breakpoint = "mobile" | "tablet" | "desktop";

function readBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < SHELL_BREAKPOINT) return "mobile";
  if (w < WIDE_BREAKPOINT) return "tablet";
  return "desktop";
}

function useBreakpointState(): Breakpoint {
  // Seeded from the real viewport rather than `undefined`. The old hooks
  // started undefined and coerced to false, which made the FIRST paint on
  // every phone render the desktop shell before swapping a frame later.
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>(readBreakpoint);

  React.useEffect(() => {
    const queries = [
      window.matchMedia(`(min-width: ${SHELL_BREAKPOINT}px)`),
      window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`),
    ];
    const onChange = () => setBreakpoint(readBreakpoint());
    queries.forEach((q) => q.addEventListener("change", onChange));
    onChange();
    return () => queries.forEach((q) => q.removeEventListener("change", onChange));
  }, []);

  return breakpoint;
}

/** Full three-step ladder, for surfaces that tune density per tier. */
export function useBreakpoint(): Breakpoint {
  return useBreakpointState();
}

/** True below 768px. Picks the app shell (bottom nav vs sidebar). */
export function useIsMobile(): boolean {
  return useBreakpointState() === "mobile";
}

/** True at 768px and up — tablets included. Gates master-detail / multi-pane. */
export function useIsDesktop(): boolean {
  return useBreakpointState() !== "mobile";
}

/** True at 1024px and up. For extras a 768px tablet genuinely can't hold. */
export function useIsWide(): boolean {
  return useBreakpointState() === "desktop";
}
