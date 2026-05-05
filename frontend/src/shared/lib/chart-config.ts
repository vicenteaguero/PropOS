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
