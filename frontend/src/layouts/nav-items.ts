import {
  Building2,
  CalendarDays,
  FileText,
  Home,
  Inbox,
  ListChecks,
  Phone,
  Receipt,
  Shield,
  Sparkles,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserView } from "@shared/types/auth";

/**
 * The single navigation tree, shared by the desktop sidebar and the mobile
 * "Más" sheet.
 *
 * It used to live inside app-sidebar.tsx, which meant the phone shell could
 * only reach whatever the bottom nav and the home tiles happened to hardcode —
 * 9 of 24 admin destinations, with Pendientes (the AI proposal queue) among the
 * 13 that were URL-only. Anything added here now surfaces on both shells.
 */

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: "pending";
  scope?: string;
  devOnly?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function filterByScope(groups: NavGroup[], adminScope: string[]): NavGroup[] {
  if (adminScope.length === 0) return groups;
  const allowed = new Set(adminScope);
  const visible = (item: NavItem) => !item.scope || allowed.has(item.scope);
  return groups
    .map((g) => ({ ...g, items: g.items.filter(visible) }))
    .filter((g) => g.items.length > 0);
}

export function filterByDev(groups: NavGroup[], isDevAdmin: boolean): NavGroup[] {
  if (isDevAdmin) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.devOnly) }))
    .filter((g) => g.items.length > 0);
}

export function buildAdminGroups(agentName: string): NavGroup[] {
  // Four groups, not seven. Every destination that used to be its own list page
  // is now a tab inside one of the four sections, so the tree stopped being a
  // map you had to memorise. Entries pointing at a tab carry the query param.
  return [
    { items: [{ label: "Inicio", path: "/admin", icon: Home, end: true }] },
    {
      label: agentName,
      items: [
        { label: agentName, path: "/admin/agent", icon: Sparkles, scope: "agent" },
        {
          label: "Pendientes",
          path: "/admin/pendientes",
          icon: Inbox,
          badge: "pending",
          scope: "pendientes",
        },
        {
          label: "Costo",
          path: "/admin/finanzas?tab=costo-propo",
          icon: Receipt,
          scope: "analytics",
          devOnly: true,
        },
      ],
    },
    {
      label: "Trabajo",
      items: [
        { label: "CRM", path: "/admin/crm", icon: Users, scope: "crm" },
        { label: "Agenda", path: "/admin/agenda", icon: CalendarDays, scope: "productividad" },
        { label: "Propiedades", path: "/admin/crm?tab=propiedades", icon: Building2 },
        { label: "Documentos", path: "/admin/documentos", icon: FileText, scope: "documents" },
        { label: "Finanzas", path: "/admin/finanzas", icon: Receipt, scope: "finanzas" },
        { label: "Workflows", path: "/admin/workflows", icon: ListChecks, scope: "workflows" },
      ],
    },
    {
      label: "Administración",
      items: [
        { label: "Usuarios", path: "/admin/users", icon: Users },
        { label: "Visitantes", path: "/admin/visitantes", icon: UserPlus },
        { label: "Teléfonos", path: "/admin/phones", icon: Phone, scope: "phones" },
        { label: "Importar", path: "/admin/datos/importar", icon: Upload, scope: "datos" },
        { label: "Tenants", path: "/admin/tenants", icon: Shield, devOnly: true },
      ],
    },
  ];
}

export function buildOwnerGroups(): NavGroup[] {
  return [
    {
      items: [{ label: "Mis propiedades", path: "/owner", icon: Home, end: true }],
    },
  ];
}

export function buildGroups(view: UserView, agentName: string, isDevAdmin: boolean): NavGroup[] {
  switch (view) {
    case "admin":
    case "admin-dev":
      return filterByDev(buildAdminGroups(agentName), isDevAdmin);
    case "agent":
      return [
        { items: [{ label: "Inicio", path: "/agent", icon: Home, end: true }] },
        {
          label: "Trabajo",
          items: [
            { label: "Pendientes", path: "/agent/pendientes", icon: Inbox, badge: "pending" },
            { label: "CRM", path: "/agent/crm", icon: Users },
            { label: "Agenda", path: "/agent/agenda", icon: CalendarDays },
            { label: "Propiedades", path: "/agent/crm?tab=propiedades", icon: Building2 },
            { label: "Documentos", path: "/agent/documentos", icon: FileText },
            { label: "Workflows", path: "/agent/workflows", icon: ListChecks },
          ],
        },
      ];
    case "owner":
      return buildOwnerGroups();
    case "buyer":
      return [
        {
          items: [
            { label: "Inicio", path: "/buyer", icon: Home, end: true },
            { label: "Documentos", path: "/buyer/documentos", icon: FileText },
          ],
        },
      ];
    case "content":
      return [
        {
          items: [
            { label: "Inicio", path: "/content", icon: Home, end: true },
            { label: agentName, path: "/content/pendientes", icon: Sparkles },
          ],
        },
      ];
    default:
      return [];
  }
}
