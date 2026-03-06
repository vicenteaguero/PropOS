import type { NavItem } from "@shared/types/api";

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Propiedades", path: "/admin/properties", icon: "building" },
  { label: "Contactos", path: "/admin/contacts", icon: "users" },
  { label: "Proyectos", path: "/admin/projects", icon: "folder" },
  { label: "Equipo", path: "/admin/users", icon: "shield" },
];
