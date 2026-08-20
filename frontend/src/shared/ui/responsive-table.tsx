import type { ReactNode } from "react";
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Row } from "./row";

export interface ResponsiveColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

export interface ResponsiveRowSpec {
  left?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}

interface ResponsiveTableProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  columns: ResponsiveColumn<T>[];
  /** How one record reads on a phone, where a table cannot fit. */
  mobileRow: (row: T) => ResponsiveRowSpec;
  onRowClick?: (row: T) => void;
  className?: string;
}

/**
 * One record set, two presentations.
 *
 * Pages used to carry a full `<table>` and a full `<Row>` list side by side,
 * both constructed on every render and switched with `isDesktop ? a : b`. That
 * is two renderings of the same data drifting apart column by column. Here the
 * columns and the phone summary are declared once, next to each other, and only
 * the chrome differs.
 */
export function ResponsiveTable<T>({
  rows,
  rowKey,
  columns,
  mobileRow,
  onRowClick,
  className,
}: ResponsiveTableProps<T>) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <div className={className}>
        {rows.map((row, i) => {
          const spec = mobileRow(row);
          return (
            <Row
              key={rowKey(row)}
              divider={i < rows.length - 1}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              left={spec.left}
              title={spec.title}
              sub={spec.sub}
              right={spec.right}
            />
          );
        })}
      </div>
    );
  }

  return (
    // The wrapper scrolls, not the page: a wide table must never widen the body.
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[12px] font-medium text-muted-foreground">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn("px-3 py-2.5 font-medium", c.align === "right" && "text-right")}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "align-middle transition",
                i < rows.length - 1 && "border-b border-border",
                onRowClick ? "cursor-pointer hover:bg-secondary/40" : "hover:bg-secondary/40",
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn("px-3 py-2.5", c.align === "right" && "text-right", c.className)}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
