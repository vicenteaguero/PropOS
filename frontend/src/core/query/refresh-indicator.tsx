import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";

/** Long enough that a warm 80ms refetch never flashes a bar at anyone. */
const SHOW_AFTER_MS = 400;

/**
 * A hairline bar at the top of the viewport while any query is refetching.
 *
 * With the cache persisted, a screen usually paints its previous rows instantly
 * and updates a moment later. Without a signal that reads as "this is still
 * arriving" the broker cannot tell fresh data from stale, and — their words —
 * starts to panic that rows are missing from the database.
 *
 * Deliberately NOT a skeleton: skeletons say "there is nothing yet", which is
 * the opposite of what is true here.
 */
export function RefreshIndicator() {
  const fetching = useIsFetching();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (fetching === 0) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [fetching]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden"
    >
      <div className="h-full w-1/3 animate-[propos-sweep_1.1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
