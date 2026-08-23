import type { CalendarItem } from "../api/calendar-api";

export interface PlacedItem {
  item: CalendarItem;
  /** 0-based column within its overlapping cluster. */
  column: number;
  /** How many columns that cluster needs. */
  columns: number;
}

const startOf = (it: CalendarItem) => (it.start_at ? Date.parse(it.start_at) : 0);
const endOf = (it: CalendarItem, minMinutes = 30) => {
  const start = startOf(it);
  const end = it.end_at ? Date.parse(it.end_at) : start;
  // A zero-length event still occupies a readable band, and treating it as a
  // point would let a later event sit on top of it.
  return Math.max(end, start + minMinutes * 60_000);
};

/**
 * Lay overlapping events out side by side instead of on top of each other.
 *
 * Every block used to be `inset-x-1`, so two events at the same hour occupied
 * exactly the same rectangle and the one underneath was unreadable and
 * unclickable — which is most of what made a busy week look broken.
 *
 * Greedy interval-graph colouring: walk the day in start order, keep the set of
 * events still running, and give each new event the lowest free column. A
 * cluster ends when nothing is running, and everyone in it shares the same
 * column count so their widths line up.
 */
export function placeOverlapping(items: CalendarItem[]): PlacedItem[] {
  const sorted = [...items].sort((a, b) => startOf(a) - startOf(b) || endOf(a) - endOf(b));
  const placed: PlacedItem[] = [];
  let cluster: PlacedItem[] = [];
  let active: { end: number; column: number }[] = [];

  const closeCluster = () => {
    if (!cluster.length) return;
    const columns = Math.max(...cluster.map((p) => p.column)) + 1;
    cluster.forEach((p) => {
      p.columns = columns;
    });
    placed.push(...cluster);
    cluster = [];
  };

  for (const item of sorted) {
    const start = startOf(item);
    active = active.filter((a) => a.end > start);
    if (active.length === 0) closeCluster();

    const taken = new Set(active.map((a) => a.column));
    let column = 0;
    while (taken.has(column)) column += 1;

    active.push({ end: endOf(item), column });
    cluster.push({ item, column, columns: 1 });
  }
  closeCluster();
  return placed;
}
