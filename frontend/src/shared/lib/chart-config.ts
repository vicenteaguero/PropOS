export const CHART_HEIGHT = 280;

export const CHART_COLORS = {
  primary: "var(--chart-1)",
  accent: "var(--chart-2)",
  neutral: "var(--chart-3)",
  surface: "var(--chart-4)",
  muted: "var(--chart-5)",
  success: "var(--success)",
  error: "var(--destructive)",
  warning: "var(--warning)",
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;

/** Pipeline stages in funnel order. Mirrors `PIPELINE_STAGE_LABELS` in ./labels. */
export const STAGE_ORDER = ["LEAD", "QUALIFIED", "VISIT", "OFFER", "RESERVATION", "CLOSED"];

/** One colour per stage, indexed by STAGE_ORDER. */
export const STAGE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.accent,
  CHART_COLORS.surface,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.neutral,
];

/** Recharts axis tick styling. Tokens only, so both themes track. */
export const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Recharts tooltip styling. */
export const TOOLTIP_STYLE = {
  fontSize: 12,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
};
