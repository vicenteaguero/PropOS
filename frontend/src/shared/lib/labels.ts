/**
 * Spanish display labels for the raw enum values the API returns.
 *
 * The UI is Spanish but the wire format is English (`OPEN`, `LEAD`,
 * `download_documents`, …). Rendering `{status}` straight from the payload
 * leaks those tokens to the broker, so every enum that reaches a screen gets
 * a map here.
 *
 * Usage:
 *   label("taskStatus", task.status)        // "OPEN"   → "Abierta"
 *   label("capability", cap)                // unknown  → returned as-is
 *
 * Unknown values fall through to the raw string, so a backend that adds an
 * enum member degrades to the token instead of blanking the cell. Add the
 * translation here when that happens.
 *
 * Lookup is case-tolerant: `open`, `OPEN` and `Open` all resolve. Some enums
 * are uppercase on the wire (`TaskStatus`) and some lowercase
 * (`ConversationStatus`), and a few endpoints have drifted between the two.
 */

export type LabelKind =
  | "taskStatus"
  | "pipelineStage"
  | "opportunityStatus"
  | "role"
  | "contactType"
  | "workflowState"
  | "capability"
  | "conversationStatus"
  | "txDirection"
  | "txStatus"
  | "txCategory"
  | "listingKind"
  | "eventStatus"
  | "eventKind"
  | "propertyStatus"
  | "documentKind"
  | "uploadStatus"
  | "interactionKind"
  | "channel"
  | "source"
  | "agentAction"
  | "autonomyLevel"
  | "rejectReason"
  | "evidenceSource"
  | "dealPropertyRole"
  | "participantRole"
  | "checklistStatus";

/** `opportunity_properties.role` — a buyer saw three and offered on one. */
export const DEAL_PROPERTY_ROLE_LABELS: Record<string, string> = {
  interest: "Le interesa",
  offered: "Ofertó",
  closed: "Cerrada",
  discarded: "Descartada",
};

/** `opportunity_participants.role`. Free text in the database, so unknown
 *  values fall through to themselves rather than being hidden. */
export const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  comprador: "Comprador",
  vendedor: "Vendedor",
  propietario: "Propietario",
  cónyuge: "Cónyuge",
  conyuge: "Cónyuge",
  "corredor contraparte": "Corredor contraparte",
  abogado: "Abogado",
  banco: "Ejecutivo del banco",
};

/** `opportunity_checklist_items.status`. */
export const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Listo",
  blocked: "Bloqueado",
  na: "No aplica",
};

/** `tasks-api.ts` → `TaskStatus`. */
export const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierta",
  IN_PROGRESS: "En curso",
  BLOCKED: "Bloqueada",
  DONE: "Lista",
  CANCELLED: "Cancelada",
};

/** `opportunities/types.ts` → `PipelineStage`. */
export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUALIFIED: "Calificado",
  VISIT: "Visita",
  OFFER: "Oferta",
  RESERVATION: "Reserva",
  CLOSED: "Cerrado",
};

/** `opportunities/types.ts` → `OpportunityStatus`. */
export const OPPORTUNITY_STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierta",
  WON: "Ganada",
  LOST: "Perdida",
};

/** `shared/types/auth.ts` → `UserRole`. */
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  AGENT: "Corredor",
  LANDOWNER: "Propietario",
  BUYER: "Comprador",
  CONTENT: "Contenido",
};

/** `contacts/types.ts` → `ContactType`. */
export const CONTACT_TYPE_LABELS: Record<string, string> = {
  BUYER: "Comprador",
  SELLER: "Vendedor",
  LANDOWNER: "Propietario",
  NOTARY: "Notaría",
  INVESTOR: "Inversionista",
  EMPLOYEE: "Empleado",
  FAMILY: "Familia",
  VENDOR: "Proveedor",
  STAKEHOLDER: "Interesado",
  OTHER: "Otro",
};

/** `workflows-api.ts` → `WorkflowRun.state`. */
export const WORKFLOW_STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Sin iniciar",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  BLOCKED: "Bloqueado",
  CANCELLED: "Cancelado",
};

/**
 * `property_grants.capabilities` tokens (migration `20240601000025`).
 * Open vocabulary on the DB side — unlisted tokens render raw by design.
 */
export const CAPABILITY_LABELS: Record<string, string> = {
  view_property: "Ver propiedad",
  view_documents: "Ver documentos",
  download_documents: "Descargar documentos",
  view_visits: "Ver visitas",
  view_visitor_identity: "Ver identidad de visitantes",
  view_visit_documents: "Ver documentos de visitas",
  comment: "Comentar",
  upload_documents: "Subir documentos",
};

/** `client-chat/types.ts` → `ConversationStatus` (lowercase on the wire). */
export const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  assigned: "Asignada",
  closed: "Cerrada",
};

/** `finance-api.ts` → `TxDirection`. */
export const TX_DIRECTION_LABELS: Record<string, string> = {
  IN: "Ingreso",
  OUT: "Egreso",
};

/** `finance-api.ts` → `TxStatus`. */
export const TX_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

/** `finance-api.ts` → `TX_CATEGORIES`. */
export const TX_CATEGORY_LABELS: Record<string, string> = {
  COMMISSION: "Comisión",
  SALE_PROCEEDS: "Venta",
  RENT: "Arriendo",
  AD_SPEND: "Publicidad",
  MARKETING: "Marketing",
  NOTARY_FEE: "Notaría",
  TAX: "Impuestos",
  UTILITY: "Servicios",
  SALARY: "Sueldos",
  SOFTWARE: "Software",
  REIMBURSEMENT: "Reembolso",
  DEPOSIT: "Depósito",
  REFUND: "Devolución",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

/** `properties` → `Property.listing_kind`. */
export const LISTING_KIND_LABELS: Record<string, string> = {
  SALE: "Venta",
  RENT: "Arriendo",
  LEASE: "Leasing",
};

/** `events/schemas.py` → `EventStatus`. This is the "Estado: SCHEDULED" leak. */
export const EVENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  DONE: "Realizado",
  CANCELLED: "Cancelado",
};

/** `events/schemas.py` → `EventKind`. */
export const EVENT_KIND_LABELS: Record<string, string> = {
  VISIT: "Visita",
  MEETING: "Reunión",
  CALL: "Llamada",
  SIGNING: "Firma",
  TODO: "Pendiente",
  OTHER: "Otro",
};

/** `properties/schemas.py` → `PropertyStatus`. */
export const PROPERTY_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservada",
  SOLD: "Vendida",
  INACTIVE: "Inactiva",
};

/** `documents/types.ts` → document kinds. */
export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  MANDATE: "Mandato",
  CONTRACT: "Contrato",
  PROMISE: "Promesa",
  DEED: "Escritura",
  APPRAISAL: "Tasación",
  ID: "Identificación",
  INVOICE: "Factura",
  RECEIPT: "Boleta",
  PLAN: "Plano",
  REGULATION: "Reglamento",
  OTHER: "Otro",
};

/** Anonymous-upload review states. */
export const UPLOAD_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
};

/** `interactions` kinds — previously duplicated in features/interactions/types.ts. */
export const INTERACTION_KIND_LABELS_SHARED: Record<string, string> = {
  VISIT: "Visita",
  CALL: "Llamada",
  MEETING: "Reunión",
  MESSAGE: "Mensaje",
  EMAIL: "Correo",
  WHATSAPP: "WhatsApp",
  NOTE: "Nota",
  OTHER: "Otro",
};

/** Communication channels used across analytics and the inbox. */
export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Correo",
  phone: "Teléfono",
  web: "Web",
  manual: "Manual",
};

/** Where a row came from. `agent` is the assistant, `import` a bulk load. */
export const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  agent: "Asistente",
  anita: "Asistente",
  import: "Importación",
  whatsapp: "WhatsApp",
  email: "Correo",
  webhook: "Webhook",
  system: "Sistema",
};

/**
 * `agent/intent_registry.py` → `REGISTRY` keys, i.e. every action Propo knows
 * how to take. Also used for the proposal cards, whose `kind` is the same token
 * with a `propose_` prefix — see `agentActionLabel`.
 */
export const AGENT_ACTION_LABELS: Record<string, string> = {
  add_note: "Agregar nota",
  attach_photos_to_property: "Adjuntar fotos a una propiedad",
  create_campaign: "Crear campaña",
  create_document_from_photos: "Crear documento con fotos",
  create_event: "Agendar evento",
  create_organization: "Crear organización",
  create_person: "Crear persona",
  create_property: "Crear propiedad",
  create_task: "Crear tarea",
  log_interaction: "Registrar interacción",
  log_transaction: "Registrar movimiento",
  update_person: "Actualizar persona",
};

/** `agent/policies.py` → `AutonomyLevel`. */
export const AUTONOMY_LEVEL_LABELS: Record<string, string> = {
  observe: "Observa",
  suggest: "Sugiere",
  execute: "Ejecuta",
};

/** `pending/schemas.py` → `RejectReason`. Already Spanish on the wire. */
export const REJECT_REASON_LABELS: Record<string, string> = {
  dato_incorrecto: "Dato incorrecto",
  entidad_equivocada: "Persona o propiedad equivocada",
  no_corresponde: "No corresponde",
  duplicado: "Duplicado",
  otro: "Otro",
};

/** `pending_proposals.evidence.source` — where the quote was captured. */
export const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Correo",
  voice: "Nota de voz",
  chat: "Chat",
};

const LABEL_MAPS: Record<LabelKind, Record<string, string>> = {
  taskStatus: TASK_STATUS_LABELS,
  pipelineStage: PIPELINE_STAGE_LABELS,
  opportunityStatus: OPPORTUNITY_STATUS_LABELS,
  role: ROLE_LABELS,
  contactType: CONTACT_TYPE_LABELS,
  workflowState: WORKFLOW_STATE_LABELS,
  capability: CAPABILITY_LABELS,
  conversationStatus: CONVERSATION_STATUS_LABELS,
  txDirection: TX_DIRECTION_LABELS,
  txStatus: TX_STATUS_LABELS,
  txCategory: TX_CATEGORY_LABELS,
  listingKind: LISTING_KIND_LABELS,
  eventStatus: EVENT_STATUS_LABELS,
  eventKind: EVENT_KIND_LABELS,
  propertyStatus: PROPERTY_STATUS_LABELS,
  documentKind: DOCUMENT_KIND_LABELS,
  uploadStatus: UPLOAD_STATUS_LABELS,
  interactionKind: INTERACTION_KIND_LABELS_SHARED,
  channel: CHANNEL_LABELS,
  source: SOURCE_LABELS,
  dealPropertyRole: DEAL_PROPERTY_ROLE_LABELS,
  participantRole: PARTICIPANT_ROLE_LABELS,
  checklistStatus: CHECKLIST_STATUS_LABELS,
  agentAction: AGENT_ACTION_LABELS,
  autonomyLevel: AUTONOMY_LEVEL_LABELS,
  rejectReason: REJECT_REASON_LABELS,
  evidenceSource: EVIDENCE_SOURCE_LABELS,
};

/** Placeholder for null/empty values, matching the em-dash used elsewhere. */
const EMPTY = "—";

/**
 * Translates one enum value. Falls back to the raw value when there is no
 * entry, and to `—` when the value is absent.
 */
export function label(kind: LabelKind, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const map = LABEL_MAPS[kind];
  const hit = map[value] ?? map[value.toUpperCase()] ?? map[value.toLowerCase()];
  if (hit !== undefined) return hit;
  // Falling through means an English enum value reaches a Spanish UI, silently.
  // That is how "Estado: SCHEDULED" survived to production; make it loud in dev.
  if (import.meta.env.DEV) {
    console.warn(
      `[labels] no ${kind} translation for "${value}" — add one in shared/lib/labels.ts`,
    );
  }
  return value;
}

/**
 * Translates a list of values (grant capabilities, tag arrays) preserving order.
 */
export function labelAll(kind: LabelKind, values: readonly string[]): string[] {
  return values.map((v) => label(kind, v));
}

/**
 * Translates a Propo action, accepting either form it appears in.
 *
 * The autonomy settings speak `action_kind` (`create_person`) while a queued
 * proposal's `kind` carries the `propose_` prefix the dispatcher adds
 * (`propose_create_person`). They name the same action, so one map serves both
 * and the two screens cannot drift apart — which is exactly what happened while
 * the proposal card kept a private copy of this list.
 */
export function agentActionLabel(kind: string | null | undefined): string {
  if (!kind) return EMPTY;
  return label("agentAction", kind.startsWith("propose_") ? kind.slice("propose_".length) : kind);
}
