/**
 * Spanish names for payload keys, so a card never leaks a raw English column.
 *
 * Shared by the proposal card and the Rectificar sheet: the sheet edits the
 * same fields the card previews, and two copies of this map would show a broker
 * two different words for the same thing on two taps of the same card.
 */
export const FIELD_LABELS_ES: Record<string, string> = {
  full_name: "Nombre",
  first_name: "Nombre",
  last_name: "Apellido",
  phone: "Teléfono",
  email: "Email",
  rut: "RUT",
  address: "Dirección",
  type: "Tipo",
  role: "Rol",
  stage: "Etapa",
  status: "Estado",
  title: "Título",
  body: "Detalle",
  note: "Nota",
  notes: "Notas",
  occurred_at: "Fecha",
  starts_at: "Inicio",
  ends_at: "Fin",
  due_at: "Vence",
  due_date: "Vence",
  amount: "Monto",
  amount_cents: "Monto",
  currency: "Moneda",
  direction: "Tipo",
  category: "Categoría",
  channel: "Canal",
  subject: "Asunto",
  interaction_type: "Tipo",
  comuna: "Comuna",
  price_clp: "Precio",
  bedrooms: "Dormitorios",
  bathrooms: "Baños",
  area_m2: "m²",
  area_sqm: "m²",
  listing_kind: "Operación",
  year_built: "Año",
  description: "Descripción",
  contact_name: "Contacto",
  property_title: "Propiedad",
  // Keys the resolver adds after matching, which reached the card raw.
  due: "Vence",
  kind: "Tipo",
  person: "Persona",
  summary: "Resumen",
  property: "Propiedad",
  organization: "Organización",
};
/** The Spanish name, or the raw key when nobody has named it yet. */
export const fieldLabel = (k: string) => FIELD_LABELS_ES[k] ?? k;
