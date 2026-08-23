/**
 * Mirror of `backend/app/core/features.py`.
 *
 * The backend owns the catalog; this file exists so a component can name a key
 * without a string literal nobody can grep. `catalog.test.ts` reads the Python
 * file and fails when the two lists drift -- a key that exists on only one side
 * is a switch that silently does nothing.
 */

export const FEATURE_KEYS = [
  "agent",
  "propo_voz",
  "pendientes",
  "crm",
  "conversaciones",
  "inbox",
  "email",
  "productividad",
  "documents",
  "propiedades",
  "portales",
  "finanzas",
  "analytics",
  "datos",
  "phones",
  "workflows",
  "uso",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * `on` normal · `wip` usable but labelled · `locked` visible and inert ·
 * `hidden` absent. The API refuses `locked` and `hidden` with 423, so none of
 * this is a cosmetic filter.
 */
export type FeatureState = "on" | "wip" | "locked" | "hidden";

export interface FeatureEntry {
  state: FeatureState;
  note: string | null;
}

export type FeatureMap = Partial<Record<string, FeatureEntry>>;

/** Missing key = `on`: a feature nobody configured behaves as it always did. */
export const DEFAULT_ENTRY: FeatureEntry = { state: "on", note: null };

export function entryFor(features: FeatureMap, key?: string): FeatureEntry {
  if (!key) return DEFAULT_ENTRY;
  return features[key] ?? DEFAULT_ENTRY;
}

/** In the nav, on a tab, as a route: is there anything to show at all? */
export function isVisible(features: FeatureMap, key?: string): boolean {
  return entryFor(features, key).state !== "hidden";
}

/** Visible but usable? `locked` is drawn, and does nothing. */
export function isEnabled(features: FeatureMap, key?: string): boolean {
  const { state } = entryFor(features, key);
  return state === "on" || state === "wip";
}

/**
 * What we say when a feature is `wip` and nobody wrote a note for this tenant.
 *
 * A tenant row's `note` always wins -- it is the sentence a dev admin typed
 * standing next to the person who hit the rough edge. This map exists so the
 * `wip` state is never announced with silence: "En desarrollo" on its own tells
 * the broker that something is unfinished but not whether they can use it, and
 * that is the only question they have.
 *
 * Written for the broker: no feature keys, no "integración", no "pipeline".
 */
export const WIP_NOTES: Record<FeatureKey, string> = {
  agent:
    "Propo ya entiende lo que le pides y puede anotar por ti, pero todavía se equivoca. Revisa siempre lo que proponga antes de aceptarlo.",
  propo_voz:
    "Puedes hablarle a Propo en vez de escribir. La transcripción falla con audios largos o con ruido de fondo.",
  pendientes:
    "Aquí llega lo que Propo entendió en una conversación y quiere anotar. Mientras Propo esté en desarrollo, esta lista puede traer cosas incompletas.",
  finanzas:
    "Puedes registrar ingresos y gastos y ver el resumen del mes. Todavía faltan las comisiones por operación y los reportes que se puedan descargar.",
  analytics:
    "Los números salen de lo que ya está cargado en la app. Mientras no esté todo cargado, tómalos como referencia y no como cierre contable.",
  crm: "Personas, negocios y su historial ya funcionan. Seguimos afinando la fusión de duplicados y el orden de la lista.",
  conversaciones:
    "Las conversaciones se ven y se responden. Falta pulir la búsqueda dentro del historial.",
  inbox: "La bandeja de WhatsApp está conectada. Puede tardar en mostrar mensajes muy recientes.",
  email: "La bandeja de correo todavía no sincroniza sola. Lo que veas puede estar desactualizado.",
  productividad: "Agenda, tareas y notas funcionan. Faltan los recordatorios automáticos.",
  documents:
    "Puedes subir y compartir archivos. Falta la firma y el vencimiento automático de documentos.",
  propiedades:
    "Las fichas de propiedad ya sirven para trabajar. Seguimos completando fotos y campos del formulario.",
  portales:
    "La publicación en portales todavía no está conectada. Por ahora publica desde el portal como siempre.",
  datos:
    "La importación desde planilla funciona con archivos simples. Revisa el resultado antes de darlo por bueno.",
  phones: "Los teléfonos del equipo se administran aquí. Falta verificar el número por SMS.",
  workflows: "Las automatizaciones se pueden ver pero todavía no se editan desde aquí.",
  uso: "Métricas internas de uso. Los números de los últimos minutos pueden faltar.",
};

/** The sentence to show for a `wip` feature: the tenant's note, else the default. */
export function wipNoteFor(features: FeatureMap, key?: string): string | null {
  if (!key) return null;
  const entry = entryFor(features, key);
  return entry.note || WIP_NOTES[key as FeatureKey] || null;
}
