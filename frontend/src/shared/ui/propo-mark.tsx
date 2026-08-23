import { cn } from "@/lib/utils";

export type PropoState = "idle" | "open" | "thinking";

interface PropoMarkProps {
  /**
   * `idle` glints about every six seconds. `open` plays the three points in
   * sequence once. `thinking` speeds the glint up so the movement MEANS
   * something rather than just happening.
   */
  state?: PropoState;
  className?: string;
}

/**
 * Propo's sparkle, drawn rather than imported, so the three points can be
 * animated one at a time.
 *
 * Why not a continuous pulse or spin: an assistant's mark sits on top of every
 * screen in the app, and something that moves the whole time is something you
 * end up not looking at — or worse, something you look at instead of the
 * content. Reacting to state is the version that carries information: still
 * while nothing is happening, a flourish when it opens, faster while it is
 * working.
 *
 * All of it is off under `prefers-reduced-motion` (see `index.css`).
 */
export function PropoMark({ state = "idle", className }: PropoMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-propo-state={state}
      className={cn("propo-mark", className)}
    >
      {/* The big four-point star. lucide's `Sparkles` path, split so the two
          small points can be timed independently. */}
      <path
        className="propo-mark__major"
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
      />
      <path className="propo-mark__minor propo-mark__minor--a" d="M20 3v4" />
      <path className="propo-mark__minor propo-mark__minor--b" d="M22 5h-4" />
    </svg>
  );
}
