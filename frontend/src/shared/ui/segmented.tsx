import { TabBar, type TabBarVariant } from "./section-tabs";

export interface SegmentedItem {
  id: string;
  label: string;
  /** Trailing count badge. */
  count?: number;
}

interface SegmentedProps {
  items: SegmentedItem[];
  value: string;
  onChange: (id: string) => void;
  /** `underline` (default) keeps the historical look; `pill` for filter rows. */
  variant?: TabBarVariant;
  /** Apply the page gutter. Off inside panes that already pad their content. */
  gutter?: boolean;
  className?: string;
}

/**
 * Controlled tab bar.
 *
 * This used to be its own underline implementation, near-identical to
 * `SectionTabs` but off by a few pixels on every metric — stacking the two,
 * which the CRM did, misaligned the labels and the left gutter. It is now a
 * name for `TabBar`, kept because six screens outside this feature import it.
 */
export function Segmented({
  items,
  value,
  onChange,
  variant = "underline",
  gutter = true,
  className,
}: SegmentedProps) {
  return (
    <TabBar
      items={items}
      value={value}
      onChange={onChange}
      variant={variant}
      gutter={gutter}
      className={className}
    />
  );
}
