/**
 * Colour palettes — the one dial that colours the whole app.
 *
 * A palette is NOT a set of screens' colours. It is four numbers per theme,
 * because `index.css` already derives every surface token from them:
 *
 *   --accent-brand              the brand colour (primary, ring, chart-1)
 *   --accent-brand-foreground   what reads on top of a filled accent
 *   --accent-2                  the support hue (chart-2, second series)
 *   --accent-3                  the third hue (chart-3)
 *   --accent-soft               the pale member (sidebar hover, chips, soft fills)
 *   --tint                      0-12%, how much of the brand bleeds into every neutral
 *
 * Four colours plus a dial, which is exactly what a source palette hands you.
 * The first pass carried only two of the four and let `--tint` stand in for the
 * cream; that dropped a colour per palette on the floor.
 *
 * That is why a palette is light/dark compatible by construction rather than by
 * hand: the ground stays near-white on paper and near-black in the dark, and
 * only the accent and the amount of tint change per theme. There is no palette
 * that "only works in dark", which is exactly what the old dev-only
 * `[data-palette]` blocks were — they hard-set `--background`, so they were
 * scoped under `.dark` and silently did nothing in light.
 *
 * Deliberately NOT touched by a palette:
 *   - `--cat-*` (categorical chart/category hues, see `shared/ui/category-palette.ts`)
 *   - `--info`, `--success`, `--warning`, `--destructive`
 * Those carry meaning. If the palette moved them, "vencido" would be a
 * different colour per user, and green would stop meaning green.
 *
 * Scope: per USER, not per workspace. Two brokers in the same brokerage may run
 * different palettes. Persisted in `profiles.preferences.palette` (survives a
 * change of phone) and mirrored into localStorage so the choice is on screen
 * before the first paint instead of one round trip later.
 */

import { getStoredTheme, type Theme } from "./theme";

/** One theme's worth of a palette. Everything else in index.css derives from these. */
export interface PaletteTone {
  /** Brand colour. Must carry `fg` on top of it at 4.5:1. */
  accent: string;
  /** Text/icon colour on a filled accent. */
  fg: string;
  /** Support hue — second series in a chart, decorative pairings. */
  support: string;
  /** Third hue — third series in a chart. The colour a source palette has left. */
  third: string;
  /**
   * The pale member of the palette (the cream, the rosa suave). Fills that
   * should read as "of the brand" without being the brand: sidebar hover,
   * chips, soft badges. In the dark theme it is the deep counterpart, not the
   * cream — a cream fill on carbon is a lamp.
   */
  soft: string;
  /** 0-12: how much brand bleeds into backgrounds, cards, borders, sidebar. */
  tint: number;
}

export interface PaletteDef {
  id: string;
  /** Shown in the picker (Spanish — it is broker-facing). */
  label: string;
  /** One line under the label. Says what it feels like, not what it is made of. */
  hint: string;
  light: PaletteTone;
  dark: PaletteTone;
}

/**
 * `auto` is not a palette — it is the absence of one. It hands the accent back
 * to the workspace (an explicit `tenants.settings.brand_color`, or a hue hashed
 * from the tenant id), which is what every user got before this existed.
 */
export const AUTO_PALETTE = "auto";

export const PALETTE_DEFS: PaletteDef[] = [
  {
    id: "rosa",
    label: "Rosa Antiguo",
    hint: "El original de PropOS. Cálido, sobrio.",
    light: {
      accent: "#B4636F",
      fg: "#FFFFFF",
      support: "#8C6D5D",
      third: "#9E9E9E",
      soft: "#F0D8DA",
      tint: 4,
    },
    dark: {
      accent: "#D4919B",
      fg: "#1C1816",
      support: "#E3B7A0",
      third: "#9E9E9E",
      soft: "#3A2A2C",
      tint: 3,
    },
  },
  {
    id: "menta",
    label: "Menta",
    hint: "Verde agua y ámbar. Fresca y clara.",
    light: {
      accent: "#2F8A6C",
      fg: "#FFFFFF",
      support: "#B57A14",
      third: "#D94E68",
      soft: "#FAE7CB",
      tint: 4,
    },
    dark: {
      accent: "#59B292",
      fg: "#06231A",
      support: "#FFC94D",
      third: "#FA6781",
      soft: "#2A2318",
      tint: 3,
    },
  },
  {
    id: "coral",
    label: "Coral",
    hint: "Frambuesa y durazno. Enérgica.",
    light: {
      accent: "#C22B54",
      fg: "#FFFFFF",
      support: "#C0642C",
      third: "#E06B80",
      soft: "#FFE6D4",
      tint: 4,
    },
    dark: {
      accent: "#E06B80",
      fg: "#2A0812",
      support: "#FFC69D",
      third: "#FFE6D4",
      soft: "#2E1A18",
      tint: 3,
    },
  },
  {
    id: "arena",
    label: "Arena",
    hint: "Tierra, musgo y papel. Muy terrenal.",
    light: {
      accent: "#8A5A2E",
      fg: "#FFFFFF",
      support: "#6B7752",
      third: "#4E220F",
      soft: "#F7F1DE",
      tint: 5,
    },
    dark: {
      accent: "#C58A54",
      fg: "#2A1408",
      support: "#B0BA99",
      third: "#E0C9A0",
      soft: "#2A2116",
      tint: 4,
    },
  },
  {
    id: "indigo",
    label: "Índigo",
    hint: "Azul de tinta sobre crema. Formal.",
    light: {
      accent: "#3C4784",
      fg: "#FFFFFF",
      support: "#6E85AC",
      third: "#111844",
      soft: "#EAE0CF",
      tint: 4,
    },
    dark: {
      accent: "#8C9CD8",
      fg: "#111844",
      support: "#EAE0CF",
      third: "#7288AE",
      soft: "#1B2140",
      tint: 4,
    },
  },
  {
    id: "vice",
    label: "Vice",
    hint: "Neón de costa: magenta y atardecer.",
    light: {
      accent: "#C71173",
      fg: "#FFFFFF",
      support: "#D9611A",
      third: "#1F7A9E",
      soft: "#FBE0EE",
      tint: 3,
    },
    dark: {
      accent: "#FF3FA4",
      fg: "#1A0320",
      support: "#FFB03A",
      third: "#35D2F5",
      soft: "#2A0A2E",
      tint: 6,
    },
  },
  {
    id: "terracota",
    label: "Terracota",
    hint: "Arcilla sobre pergamino. Editorial.",
    light: {
      accent: "#A9573C",
      fg: "#FFFFFF",
      support: "#7E7457",
      third: "#4A4437",
      soft: "#E8E4D8",
      tint: 4,
    },
    dark: {
      accent: "#CC785C",
      fg: "#191919",
      support: "#E8E4D8",
      third: "#B7B2A6",
      soft: "#2A2724",
      tint: 4,
    },
  },
  {
    id: "oceano",
    label: "Océano",
    hint: "Azul profundo y verde marino.",
    light: {
      accent: "#0E6A8C",
      fg: "#FFFFFF",
      support: "#2F7F6D",
      third: "#3F5E7A",
      soft: "#DCEAF0",
      tint: 4,
    },
    dark: {
      accent: "#58B6D6",
      fg: "#04212C",
      support: "#7FD1B5",
      third: "#A9C4D8",
      soft: "#10242E",
      tint: 4,
    },
  },
  {
    id: "bosque",
    label: "Bosque",
    hint: "Pino y liquen. Tranquila.",
    light: {
      accent: "#2E6B52",
      fg: "#FFFFFF",
      support: "#71833E",
      third: "#4A5C3A",
      soft: "#DCEAE1",
      tint: 4,
    },
    dark: {
      accent: "#6FBF95",
      fg: "#06241A",
      support: "#C3D08A",
      third: "#9DBFA5",
      soft: "#16281F",
      tint: 3,
    },
  },
  {
    id: "ciruela",
    label: "Ciruela",
    hint: "Violeta y rosa. Poco común.",
    light: {
      accent: "#6B3FA0",
      fg: "#FFFFFF",
      support: "#A44C81",
      third: "#4A3468",
      soft: "#EDE2F5",
      tint: 4,
    },
    dark: {
      accent: "#B79CE8",
      fg: "#1A0F2E",
      support: "#F0A6C8",
      third: "#C9B8E0",
      soft: "#241734",
      tint: 4,
    },
  },
  {
    id: "grafito",
    label: "Grafito",
    hint: "Sin color. Sólo el contenido.",
    light: {
      accent: "#3A3F47",
      fg: "#FFFFFF",
      support: "#7B8189",
      third: "#A8AEB6",
      soft: "#EDEEF0",
      tint: 0,
    },
    dark: {
      accent: "#C6CBD4",
      fg: "#14171C",
      support: "#8A919E",
      third: "#5F656E",
      soft: "#1E2228",
      tint: 0,
    },
  },
];

export type Palette = string;

const BY_ID = new Map(PALETTE_DEFS.map((p) => [p.id, p]));

export function getPalette(id: Palette | null | undefined): PaletteDef | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** The tone a palette shows in a given theme. Used by the app and the picker alike. */
export function toneFor(def: PaletteDef, theme: Theme): PaletteTone {
  return theme === "dark" ? def.dark : def.light;
}

/**
 * The neutral ground each theme paints, named here so the picker's preview and
 * the real app cannot drift. Mirrors `--background` / `--card` in index.css.
 */
export const NEUTRALS: Record<Theme, { bg: string; card: string; line: string }> = {
  light: { bg: "#fbfaf8", card: "#ffffff", line: "#e4e1db" },
  dark: { bg: "#0c0e12", card: "#15181e", line: "#272c34" },
};

const STORAGE_KEY = "propos:palette";
const THEME_EVENT = "propos:theme-change";

export function getStoredPalette(): Palette {
  if (typeof window === "undefined") return AUTO_PALETTE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw && BY_ID.has(raw) ? raw : AUTO_PALETTE;
}

/** True while a real palette is chosen — i.e. the workspace accent is overridden. */
export function paletteOwnsAccent(): boolean {
  return getStoredPalette() !== AUTO_PALETTE;
}

/**
 * Write the palette onto <html> as inline custom properties.
 *
 * Inline rather than a `[data-palette]` CSS block on purpose: it is the same
 * mechanism the tenant accent already uses, so exactly one of the two owns the
 * accent tokens and there is no specificity race between them.
 */
export function applyPalette(id: Palette, theme: Theme = getStoredTheme()): void {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  const def = getPalette(id);

  if (!def) {
    // Auto: drop everything we own and let the tenant accent paint.
    style.removeProperty("--accent-brand");
    style.removeProperty("--accent-brand-foreground");
    style.removeProperty("--accent-2");
    style.removeProperty("--accent-3");
    style.removeProperty("--accent-soft");
    style.removeProperty("--tint");
    document.documentElement.dataset.palette = AUTO_PALETTE;
    return;
  }

  const tone = toneFor(def, theme);
  style.setProperty("--accent-brand", tone.accent);
  style.setProperty("--accent-brand-foreground", tone.fg);
  style.setProperty("--accent-2", tone.support);
  style.setProperty("--accent-3", tone.third);
  style.setProperty("--accent-soft", tone.soft);
  style.setProperty("--tint", `${tone.tint}%`);
  // Not used for colour — a couple of palettes want a structural tweak (see
  // index.css) and screenshots want to name the palette they caught.
  document.documentElement.dataset.palette = def.id;
}

export function setPalette(id: Palette): void {
  if (typeof window === "undefined") return;
  if (id === AUTO_PALETTE) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, id);
  applyPalette(id);
}

/**
 * Restore the persisted palette before first paint, and keep it correct across
 * theme flips.
 *
 * The theme hook is an event rather than an import because a palette's accent
 * differs per theme (darker on paper so it reads as text, lighter on carbon so
 * it does not glare), so toggling light/dark has to re-resolve the tone.
 * `theme.ts` dispatching an event instead of calling in here keeps the two
 * modules from importing each other.
 */
export function bootstrapPalette(): void {
  applyPalette(getStoredPalette());
  if (typeof window === "undefined") return;
  window.addEventListener(THEME_EVENT, () => applyPalette(getStoredPalette()));
}
