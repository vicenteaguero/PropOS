/** Period bucket a task lands in (overdue is folded into "today"). */
export type Period = "today" | "tomorrow" | "week" | "nextweek" | "nodate";

/** Whose tasks the list is showing. */
export type TaskScope = "mine" | "team";

export const PERIOD_META: { id: Period; label: string; title: string }[] = [
  { id: "today", label: "Hoy", title: "Hoy" },
  { id: "tomorrow", label: "Mañana", title: "Mañana" },
  { id: "week", label: "Semana", title: "Esta semana" },
  { id: "nextweek", label: "Próxima", title: "Próxima semana" },
  { id: "nodate", label: "Sin fecha", title: "Sin fecha" },
];
