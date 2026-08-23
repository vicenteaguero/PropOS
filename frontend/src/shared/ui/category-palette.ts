/**
 * The fixed palette for categories — event types, and the three calendar
 * sources beside them.
 *
 * It exists because the calendar used `--accent-brand` as the colour of an
 * event, and `--accent-brand` is derived from the workspace's hue
 * (`hueForTenant`). A brand cannot be a member of a categorical palette: for
 * one tenant "Evento" was violet and legible beside "Pago" and "Tarea", and for
 * the next it landed on the same green as `--success` and the legend became a
 * row of identical dots.
 *
 * Eight hues, spaced far enough apart in OKLCH to survive both themes and the
 * common colour-vision deficiencies. Chosen for distinctness, not for meaning —
 * meaning comes from the label beside the swatch.
 */
export const CATEGORY_COLORS = [
  "violet",
  "indigo",
  "sky",
  "teal",
  "lime",
  "amber",
  "orange",
  "rose",
  "slate",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const CATEGORY_LABELS: Record<CategoryColor, string> = {
  violet: "Violeta",
  indigo: "Índigo",
  sky: "Celeste",
  teal: "Verde azulado",
  lime: "Verde",
  amber: "Ámbar",
  orange: "Naranjo",
  rose: "Rosa",
  slate: "Gris",
};

/** A colour name we do not know renders as `slate` rather than as nothing. */
export function asCategoryColor(value: string | null | undefined): CategoryColor {
  return (CATEGORY_COLORS as readonly string[]).includes(value ?? "")
    ? (value as CategoryColor)
    : "slate";
}

/**
 * The three CSS values a category needs. Read straight from custom properties
 * so the theme swap happens in CSS and never in a re-render.
 *
 * `ink` is the text and the dot; `wash` is the filled-chip background; `edge`
 * is its border. All three are derived from one hue in `index.css`.
 */
export function categoryVars(color: string | null | undefined): {
  ink: string;
  wash: string;
  edge: string;
} {
  const key = asCategoryColor(color);
  return {
    ink: `var(--cat-${key})`,
    wash: `color-mix(in oklab, var(--cat-${key}) 16%, transparent)`,
    edge: `color-mix(in oklab, var(--cat-${key}) 42%, transparent)`,
  };
}
