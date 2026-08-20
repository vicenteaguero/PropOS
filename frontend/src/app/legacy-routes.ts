/**
 * Every path this app has moved, and where it goes now.
 *
 * Data, not JSX, for one reason: the redirect test used to rebuild the route
 * table by hand, so it proved that `<Navigate>` works — never that OUR router
 * still routes. A regression here is silent (the user lands on the catch-all
 * and gets bounced to "/"), and silent is exactly what a saved link or a push
 * notification deep link hits.
 *
 * `to` is relative to the role segment (`/admin`, `/agent`), so `../` climbs
 * out of the old path and back into the section.
 */
export interface LegacyRoute {
  /** Old path, relative to the role segment. */
  from: string;
  /** New path, relative to the old one. */
  to: string;
}

export const LEGACY_CLIENT_ROUTES: LegacyRoute[] = [
  // The section itself. It was CRM until the redesign.
  { from: "crm", to: "../clientes" },
  // The inbox, through all four names it has had.
  { from: "bandeja", to: "../clientes?tab=bandeja" },
  { from: "client-inbox", to: "../clientes?tab=whatsapp" },
  { from: "correos", to: "../clientes?tab=correos" },
  // The entity lists, before they became tabs.
  { from: "personas", to: "../clientes?tab=personas" },
  { from: "interacciones", to: "../clientes?tab=interacciones" },
  { from: "oportunidades", to: "../clientes?tab=oportunidades" },
  { from: "properties", to: "../clientes?tab=propiedades" },
  { from: "propiedades", to: "../clientes?tab=propiedades" },
];

export const LEGACY_AGENDA_ROUTES: LegacyRoute[] = [
  { from: "calendario", to: "../agenda?tab=calendario" },
  { from: "tareas", to: "../agenda?tab=tareas" },
  { from: "notas", to: "../agenda?tab=notas" },
];
