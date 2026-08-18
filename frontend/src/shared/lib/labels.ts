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
  | "txCategory";

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
  return map[value] ?? map[value.toUpperCase()] ?? map[value.toLowerCase()] ?? value;
}

/**
 * Translates a list of values (grant capabilities, tag arrays) preserving order.
 */
export function labelAll(kind: LabelKind, values: readonly string[]): string[] {
  return values.map((v) => label(kind, v));
}
