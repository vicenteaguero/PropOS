import type { NavItem } from "@shared/types/api";

export const AGENT_NAV_ITEMS: NavItem[] = [
  { label: "Propiedades", path: "/agent/properties", icon: "building" },
  { label: "Contactos", path: "/agent/contacts", icon: "users" },
  { label: "Interacciones", path: "/agent/interactions", icon: "message" },
];
